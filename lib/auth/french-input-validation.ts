import type { FormEvent, InvalidEvent } from 'react';

function applyFrenchEmailValidity(input: HTMLInputElement) {
  if (input.validity.valueMissing) {
    input.setCustomValidity('Veuillez renseigner ce champ.');
    return;
  }

  const value = input.value.trim();
  if (!value.includes('@')) {
    input.setCustomValidity(
      `Veuillez inclure un « @ » dans l'adresse e-mail. « ${value} » ne contient pas de « @ ».`
    );
    return;
  }

  if (!input.checkValidity()) {
    input.setCustomValidity('Veuillez saisir une adresse e-mail valide.');
    return;
  }

  input.setCustomValidity('');
}

export function applyFrenchInputValidity(input: HTMLInputElement) {
  if (input.type === 'email') {
    applyFrenchEmailValidity(input);
    return;
  }

  if (input.validity.valueMissing) {
    input.setCustomValidity('Veuillez renseigner ce champ.');
    return;
  }

  if (input.validity.tooShort) {
    input.setCustomValidity(
      `Veuillez saisir au moins ${input.minLength} caractère${input.minLength > 1 ? 's' : ''}.`
    );
    return;
  }

  input.setCustomValidity('');
}

export function validateFrenchForm(form: HTMLFormElement): boolean {
  form.querySelectorAll('input').forEach((el) => {
    if (el instanceof HTMLInputElement) {
      applyFrenchInputValidity(el);
    }
  });

  if (!form.checkValidity()) {
    form.reportValidity();
    return false;
  }

  return true;
}

export function onFrenchInputInvalid(event: InvalidEvent<HTMLInputElement>) {
  applyFrenchInputValidity(event.currentTarget);
}

export function onFrenchInputChange(event: FormEvent<HTMLInputElement>) {
  event.currentTarget.setCustomValidity('');
}
