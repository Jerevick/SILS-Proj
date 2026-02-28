"use client";

/**
 * Builds A-Frame scene HTML from sceneConfig.
 * sceneConfig: { sky?: { color }, ground?: { radius, color }, entities?: Array<{ tag, ...attrs }> }
 */

export type SceneEntity = {
  tag: string;
  [key: string]: string | number | undefined;
};

export type SceneConfig = {
  sky?: { color?: string };
  ground?: { radius?: number; color?: string };
  entities?: SceneEntity[];
};

const DEFAULT_SCENE: SceneConfig = {
  sky: { color: "#0a0a1a" },
  ground: { radius: 50, color: "#0f172a" },
  entities: [
    { tag: "a-box", position: "0 1.5 -3", color: "#00f5ff", width: "1", height: "1", depth: "1" },
    { tag: "a-sphere", position: "2 1 -4", color: "#a855f7", radius: "0.5" },
    { tag: "a-cylinder", position: "-2 0.5 -3", color: "#22c55e", radius: "0.5", height: "1" },
  ],
};

function attrString(attrs: Record<string, string | number | undefined>): string {
  return Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, "&quot;")}"`)
    .join(" ");
}

export function sceneConfigToHtml(config: Record<string, unknown> | null | undefined): string {
  const c = (config as SceneConfig | null) ?? DEFAULT_SCENE;
  const parts: string[] = [];

  if (c.sky) {
    const color = c.sky.color ?? "#0a0a1a";
    parts.push(`<a-sky color="${color}"></a-sky>`);
  }

  if (c.ground) {
    const radius = c.ground.radius ?? 50;
    const color = c.ground.color ?? "#0f172a";
    parts.push(`<a-circle position="0 0 0" rotation="-90 0 0" radius="${radius}" color="${color}" material="shader:flat"></a-circle>`);
  }

  const entities = Array.isArray(c.entities) ? c.entities : DEFAULT_SCENE.entities ?? [];
  for (const ent of entities) {
    if (!ent || typeof ent !== "object" || !ent.tag) continue;
    const { tag, ...attrs } = ent as SceneEntity;
    const name = String(tag).toLowerCase();
    if (!name.startsWith("a-")) continue;
    parts.push(`<${name} ${attrString(attrs)}></${name}>`);
  }

  return parts.join("\n");
}
