import { useState, type FormEvent } from "react";
import { Button } from "../ui";
import { EmptyState, Panel, ViewHeader } from "../ui/common";
import { formatDate, uid, useApp } from "../lib/app";
import { load, save } from "../lib/storage";

export function SolarSmart() {
  return (
    <div className="view-body">
      <ViewHeader title="Solar Smart" subtitle="Ideas for Roblox experiences, based on research" />
      <EmptyState title="Not available yet">
        <p>Solar Smart will show which genres, mechanics and monetisation patterns are working on Roblox.</p>
        <p>It will not show any Roblox trend data until that data has a source and a date.</p>
      </EmptyState>
    </div>
  );
}

export function Research() {
  return (
    <div className="view-body">
      <ViewHeader title="Research" subtitle="Saved research for your projects" />
      <EmptyState title="Not available yet">
        <p>Research will collect findings, each with a source and a date, that you can cite in your projects. Nothing is shown until real sources are connected.</p>
        <p>Until then, ask in the Roblox Studio or Blender workspace.</p>
      </EmptyState>
    </div>
  );
}

export function Assets() {
  return (
    <div className="view-body">
      <ViewHeader title="Assets" subtitle="Models, textures and scripts for your projects" />
      <EmptyState title="Not available yet">
        <p>Assets will hold files you generate or upload in Space Studio and Cloud. Asset storage is not connected in this version.</p>
      </EmptyState>
    </div>
  );
}

interface LocalProject { id: string; name: string; path: string; addedAt: number }

export function Projects() {
  const [items, setItems] = useState<LocalProject[]>(() => load<LocalProject[]>("projects", []));
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const update = (next: LocalProject[]) => {
    setItems(next);
    save("projects", next);
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;
    update([{ id: uid("p"), name: name.trim(), path: path.trim(), addedAt: Date.now() }, ...items]);
    setName("");
    setPath("");
  };
  return (
    <div className="view-body">
      <ViewHeader title="Projects" subtitle="Shortcuts to project folders, stored only on this computer" />
      <Panel title="Add a project" id="proj-add">
        <form className="form-row" onSubmit={add}>
          <label className="field">
            <span className="field__label">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Obby Adventure" required />
          </label>
          <label className="field field--grow">
            <span className="field__label">Folder path</span>
            <input className="input mono" value={path} onChange={(e) => setPath(e.target.value)} placeholder="C:\Users\you\Projects\obby" required spellCheck={false} />
          </label>
          <Button type="submit" variant="primary" disabled={!name.trim() || !path.trim()}>Add</Button>
        </form>
      </Panel>
      {items.length === 0 ? (
        <EmptyState title="No projects">Add a name and folder path above. Space Studio does not read or upload these folders.</EmptyState>
      ) : (
        <Panel title={`Your projects (${items.length})`} id="proj-list">
          <ul className="list">
            {items.map((p) => (
              <li key={p.id} className="list__item">
                <div className="list__main">
                  <strong>{p.name}</strong>
                  <span className="mono muted small ellipsis">{p.path}</span>
                </div>
                <span className="muted small">Added {formatDate(p.addedAt)}</span>
                <Button size="sm" variant="ghost" label={`Remove ${p.name}`} onClick={() => update(items.filter((x) => x.id !== p.id))}>Remove</Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

export function TaskHistory() {
  const { chats, openChat } = useApp();
  const list = Object.values(chats).filter((c) => c.messages.length > 0).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="view-body">
      <ViewHeader title="Task history" subtitle="Chats from this session. History is not saved after you quit." />
      {list.length === 0 ? (
        <EmptyState title="No chats">Chats from the Roblox Studio and Blender workspaces are listed here.</EmptyState>
      ) : (
        <Panel id="hist" title={`${list.length} chat${list.length === 1 ? "" : "s"}`}>
          <ul className="list">
            {list.map((c) => {
              const replies = c.messages.filter((m) => m.role === "assistant");
              const credits = replies.reduce((s, m) => s + (m.usage?.units ?? 0), 0);
              return (
                <li key={c.id} className="list__item">
                  <div className="list__main">
                    <strong className="ellipsis">{c.title}</strong>
                    <span className="muted small">
                      {c.workspace === "blender" ? "Blender" : c.workspace === "roblox" ? "Roblox Studio" : "Assistant"} · {formatDate(c.createdAt)} · {c.messages.length} messages · {credits.toLocaleString()} credits
                    </span>
                  </div>
                  {c.workspace !== "general" && <Button size="sm" variant="secondary" label={`Open ${c.title}`} onClick={() => openChat(c.id)}>Open</Button>}
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
