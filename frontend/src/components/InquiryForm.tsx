'use client';

import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../lib/config';
import { Button, ErrorMessage, Field, Input, SuccessMessage } from './ui';

type State = 'idle' | 'sending' | 'sent' | 'duplicate' | 'error';

export function InquiryForm({ propertyId, ownerId }: { propertyId: string; ownerId?: string }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    inquirerName: '',
    inquirerEmail: '',
    inquirerPhone: '',
    message: '',
    website: '', // honeypot — must stay empty
  });
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  // Owners don't inquire on their own listing — hide the form for them.
  // (Checked after hooks so hook order stays consistent across renders.)
  if (user && ownerId && user.id === ownerId) return null;

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.inquirerName || !form.inquirerEmail || !form.message) {
      setError('Name, email and message are required.');
      setState('error');
      return;
    }
    setState('sending');
    try {
      const res = await fetch(`${API_URL}/api/properties/${propertyId}/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.status === 201 || res.status === 200) {
        setState('sent');
        return;
      }
      if (res.status === 409) {
        setState('duplicate');
        return;
      }
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Could not send inquiry.');
      setState('error');
    } catch {
      setError('Network error — please try again.');
      setState('error');
    }
  }

  const card = (children: React.ReactNode) => (
    <div className="rounded-lg border border-gray-200 bg-white p-5">{children}</div>
  );

  if (state === 'sent') {
    return card(<SuccessMessage message="Inquiry sent! The owner will get back to you." />);
  }
  if (state === 'duplicate') {
    return card(
      <SuccessMessage message="You've already sent an inquiry for this property today." />,
    );
  }

  return card(
    <form onSubmit={onSubmit} className="space-y-3">
      <h3 className="text-lg font-semibold">Contact the owner</h3>
      <Field label="Name">
        <Input value={form.inquirerName} onChange={set('inquirerName')} />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.inquirerEmail} onChange={set('inquirerEmail')} />
      </Field>
      <Field label="Phone (optional)">
        <Input value={form.inquirerPhone} onChange={set('inquirerPhone')} />
      </Field>
      <Field label="Message">
        <textarea
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
          rows={4}
          value={form.message}
          onChange={set('message')}
        />
      </Field>
      {/* Honeypot: hidden from real users, tempting to bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={form.website}
        onChange={set('website')}
        className="hidden"
      />
      <ErrorMessage message={error} />
      <Button type="submit" disabled={state === 'sending'} className="w-full">
        {state === 'sending' ? 'Sending…' : 'Send inquiry'}
      </Button>
    </form>,
  );
}
