'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { titleCase } from '../lib/format';
import { CITIES, PROPERTY_TYPES, Property, PropertyType } from '../lib/types';
import { Button, ErrorMessage, Field, Input, Select } from './ui';

interface Props {
  mode: 'create' | 'edit';
  initial?: Property;
}

export function PropertyForm({ mode, initial }: Props) {
  const { authFetch } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    price: initial?.price?.toString() ?? '',
    city: initial?.city ?? '',
    propertyType: (initial?.propertyType ?? 'house') as PropertyType,
    bedrooms: initial?.bedrooms?.toString() ?? '1',
    bathrooms: initial?.bathrooms?.toString() ?? '1',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState(initial?.images ?? []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate(): string | null {
    if (!form.title.trim()) return 'Title is required.';
    if (!form.description.trim()) return 'Description is required.';
    if (!(Number(form.price) > 0)) return 'Price must be greater than 0.';
    if (!form.city.trim()) return 'City is required.';
    return null;
  }

  async function uploadImages(propertyId: string) {
    if (files.length === 0) return;
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    const res = await authFetch(`/api/properties/${propertyId}/images`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) throw new Error('Listing saved, but image upload failed.');
  }

  async function removeExisting(imageId: string) {
    if (!initial) return;
    const res = await authFetch(`/api/properties/${initial.id}/images/${imageId}`, {
      method: 'DELETE',
    });
    if (res.ok) setExisting((imgs) => imgs.filter((i) => i.id !== imageId));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) return setError(v);
    setError('');
    setBusy(true);

    const payload = {
      title: form.title,
      description: form.description,
      price: Number(form.price),
      city: form.city,
      propertyType: form.propertyType,
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
    };

    try {
      let id = initial?.id;
      if (mode === 'create') {
        const res = await authFetch('/api/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error?.message ?? 'Create failed');
        id = (await res.json()).id;
      } else {
        const res = await authFetch(`/api/properties/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error?.message ?? 'Update failed');
      }
      if (id) await uploadImages(id);
      router.push(`/properties/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Title">
        <Input value={form.title} onChange={set('title')} />
      </Field>
      <Field label="Description">
        <textarea
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
          rows={5}
          value={form.description}
          onChange={set('description')}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Price (USD)">
          <Input type="number" value={form.price} onChange={set('price')} />
        </Field>
        <Field label="City">
          <Select value={form.city} onChange={set('city')}>
            <option value="" disabled>
              Select a city
            </option>
            {/* Keep an out-of-list value (e.g. a legacy listing's city) selectable. */}
            {form.city && !CITIES.includes(form.city) && (
              <option value={form.city}>{form.city}</option>
            )}
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type">
          <Select value={form.propertyType} onChange={set('propertyType')}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Beds">
            <Input type="number" value={form.bedrooms} onChange={set('bedrooms')} />
          </Field>
          <Field label="Baths">
            <Input type="number" value={form.bathrooms} onChange={set('bathrooms')} />
          </Field>
        </div>
      </div>

      {/* Existing images (edit mode) */}
      {existing.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Current images</p>
          <div className="grid grid-cols-4 gap-2">
            {existing.map((img) => (
              <div key={img.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="aspect-square w-full rounded object-cover" />
                <button
                  type="button"
                  onClick={() => removeExisting(img.id)}
                  className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New image upload + preview */}
      <Field label="Add images">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="text-sm"
        />
      </Field>
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {files.map((f, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={URL.createObjectURL(f)}
              alt={f.name}
              className="aspect-square w-full rounded object-cover"
            />
          ))}
        </div>
      )}

      <ErrorMessage message={error} />
      <Button type="submit" disabled={busy}>
        {busy ? 'Saving…' : mode === 'create' ? 'Create listing' : 'Save changes'}
      </Button>
    </form>
  );
}
