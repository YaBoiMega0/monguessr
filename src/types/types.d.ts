export type GameState = {
  difficulty: Difficulty;
  locationId: number;
  correctx: number;
  correcty: number;
  score: number;
};

export type LocGuess = {
  sessionid: number;
  xpos: number;
  ypos: number;
};

export type LocResponse = {
  xpos: number | null;
  ypos: number | null;
  distance: number;
  score: number;
  curr_round: number;
};

export type LocInfo = {
  difficulty: Difficulty;
  tags: Tag[];
  xpos: number;
  ypos: number;
};

export type Difficulty = "easy" | "medium" | "hard" | "impossible";
type GameMode = "standard" | "endless";
export type Tag = "all" | "indoor" | "outdoor" | "carpark";

export type StandardParams = {
    gamemode: GameMode;
    difficulty: Difficulty;
}
export type CustomParams = {
    gamemode: GameMode;
    gamemodeParam: number;
    timerSeconds: number;
    difficulties: Difficulty[];
    tags: Tag[];
}
export type Params = StandardParams | CustomParams

export type SidReply = {
  sessionid: number
}