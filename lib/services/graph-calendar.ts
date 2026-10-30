/**
 * Microsoft Graph — calendrier Outlook du DGA.
 * Configure GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, DG_OUTLOOK_EMAIL
 * Permissions application : Calendars.ReadWrite (+ OnlineMeetings.ReadWrite.All pour Teams)
 */

export type GraphEventInput = {
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  participantEmails: string[];
  isOnlineMeeting?: boolean;
};

export type OutlookEventResult = {
  eventId: string;
  teamsJoinUrl?: string | null;
  teamsMeetingId?: string | null;
};

type GraphEventResponse = {
  id?: string;
  onlineMeeting?: {
    joinUrl?: string;
    conferenceId?: string;
  };
};

function graphConfigured() {
  return Boolean(
    process.env.GRAPH_TENANT_ID &&
      process.env.GRAPH_CLIENT_ID &&
      process.env.GRAPH_CLIENT_SECRET &&
      process.env.DG_OUTLOOK_EMAIL
  );
}

async function getAccessToken(): Promise<string | null> {
  if (!graphConfigured()) return null;

  const tenant = process.env.GRAPH_TENANT_ID!;
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GRAPH_CLIENT_ID!,
      client_secret: process.env.GRAPH_CLIENT_SECRET!,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

function buildEventBody(input: GraphEventInput) {
  const timeZone = process.env.TZ ?? 'Africa/Conakry';
  return {
    subject: input.title,
    body: { contentType: 'HTML', content: input.description ?? '' },
    start: { dateTime: input.startAt.toISOString(), timeZone },
    end: { dateTime: input.endAt.toISOString(), timeZone },
    attendees: input.participantEmails.map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    })),
    ...(input.isOnlineMeeting
      ? {
          isOnlineMeeting: true,
          onlineMeetingProvider: 'teamsForBusiness',
        }
      : {}),
  };
}

function parseEventResponse(json: GraphEventResponse): OutlookEventResult | null {
  if (!json.id) return null;
  return {
    eventId: json.id,
    teamsJoinUrl: json.onlineMeeting?.joinUrl ?? null,
    teamsMeetingId: json.onlineMeeting?.conferenceId ?? null,
  };
}

function mockEventResult(input: GraphEventInput): OutlookEventResult {
  const stamp = Date.now();
  return {
    eventId: `mock-${stamp}`,
    ...(input.isOnlineMeeting
      ? {
          teamsJoinUrl: `https://teams.microsoft.com/l/meetup-join/mock-${stamp}`,
          teamsMeetingId: `mock-teams-${stamp}`,
        }
      : {}),
  };
}

export async function createOutlookEvent(input: GraphEventInput): Promise<OutlookEventResult | null> {
  const token = await getAccessToken();
  const mailbox = process.env.DG_OUTLOOK_EMAIL;
  if (!token || !mailbox) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[graph:mock] create event', input.title, input.startAt.toISOString(), {
        teams: input.isOnlineMeeting,
      });
    }
    return mockEventResult(input);
  }

  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildEventBody(input)),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as GraphEventResponse;
  return parseEventResponse(json);
}

export async function updateOutlookEvent(
  input: GraphEventInput & { eventId: string }
): Promise<OutlookEventResult | null> {
  const token = await getAccessToken();
  const mailbox = process.env.DG_OUTLOOK_EMAIL;
  if (!token || !mailbox) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[graph:mock] update event', input.eventId, {
        teams: input.isOnlineMeeting,
      });
    }
    return {
      eventId: input.eventId,
      ...(input.isOnlineMeeting
        ? {
            teamsJoinUrl: `https://teams.microsoft.com/l/meetup-join/mock-update-${Date.now()}`,
            teamsMeetingId: `mock-teams-update-${Date.now()}`,
          }
        : { teamsJoinUrl: null, teamsMeetingId: null }),
    };
  }

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${mailbox}/events/${input.eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildEventBody(input)),
    }
  );

  if (!res.ok) return null;
  const json = (await res.json()) as GraphEventResponse;
  return parseEventResponse({ ...json, id: json.id ?? input.eventId });
}

/** Retire l’événement Outlook lorsqu’un rendez-vous approuvé est reporté. */
export async function cancelOutlookEvent(eventId: string): Promise<boolean> {
  const token = await getAccessToken();
  const mailbox = process.env.DG_OUTLOOK_EMAIL;
  if (!token || !mailbox) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[graph:mock] cancel event', eventId);
    }
    return true;
  }

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${mailbox}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return res.ok || res.status === 404;
}
