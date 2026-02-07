"use client";

import { useState } from "react";
import { Modal } from "./Modal";

interface CreateWorldModalProps {
  themes: readonly string[];
  disabled: boolean;
  disabledReason?: string;
}

export function CreateWorldModal({ themes, disabled, disabledReason }: CreateWorldModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={disabled}>
        {disabledReason ?? "New World"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Create World">
        <form action="/api/rooms" method="post" className="grid">
          <label htmlFor="cw-name">
            Room name
            <input
              id="cw-name"
              required
              name="name"
              minLength={3}
              maxLength={64}
              placeholder="My awesome world"
            />
          </label>
          <div className="grid two">
            <label htmlFor="cw-theme">
              Theme
              <select id="cw-theme" name="theme" defaultValue={themes[0]}>
                {themes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="cw-seed">
              Seed
              <input id="cw-seed" name="seed" placeholder="Auto-generated" />
            </label>
          </div>
          <label htmlFor="cw-password">
            World password
            <input
              id="cw-password"
              required
              type="password"
              name="password"
              minLength={8}
            />
          </label>
          <button type="submit">Create World</button>
        </form>
      </Modal>
    </>
  );
}
