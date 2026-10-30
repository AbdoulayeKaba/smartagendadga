import {
  DEFAULT_APPOINTMENT_BUSINESS_RULES,
  normalizeBusinessRules,
  type AppointmentBusinessRules,
} from '@/lib/dg/appointment-business-rules';

let rules: AppointmentBusinessRules = { ...DEFAULT_APPOINTMENT_BUSINESS_RULES };

export function mockGetAppointmentBusinessRules(): AppointmentBusinessRules {
  return normalizeBusinessRules(rules);
}

export function mockUpdateAppointmentBusinessRules(
  patch: Partial<AppointmentBusinessRules>
): AppointmentBusinessRules {
  rules = normalizeBusinessRules({ ...rules, ...patch });
  return rules;
}
