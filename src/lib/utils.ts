/** A player's display label — their name, or their id when they have no name. */
export function displayName(player: { playerName?: string | null; playerId: string }): string {
  const name = player.playerName?.trim();
  return name ? name : player.playerId;
}

/** Scalar variant for surfaces that hold a name and id separately. */
export function nameOrId(name: string | null | undefined, id: string): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : id;
}
