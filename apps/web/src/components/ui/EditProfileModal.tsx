"use client";

import { useState } from "react";
import { Modal } from "./Modal";

interface EditProfileModalProps {
  displayName: string;
  avatarColor: string;
  avatarColors: readonly string[];
}

export function EditProfileModal({
  displayName,
  avatarColor,
  avatarColors,
}: EditProfileModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="secondary" type="button" onClick={() => setOpen(true)}>
        Edit Profile
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit Profile">
        <form action="/api/profile" method="post" className="grid">
          <label htmlFor="ep-name">
            Display name
            <input
              id="ep-name"
              required
              name="displayName"
              defaultValue={displayName}
              minLength={2}
              maxLength={40}
            />
          </label>
          <label htmlFor="ep-color">
            Avatar color
            <select id="ep-color" name="avatarColor" defaultValue={avatarColor}>
              {avatarColors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Save</button>
        </form>
      </Modal>
    </>
  );
}
