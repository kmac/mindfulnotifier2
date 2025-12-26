const defaultTagName = "default";

// Default probability of selecting from favourites pool when favourites exist
// This value is used when no preference is provided; the actual value comes from Redux store
export const DEFAULT_FAVOURITE_SELECTION_PROBABILITY = 0.2;

export type JsonReminder = {
  text: string;
  enabled: boolean;
  tag: string;
  favourite?: boolean;
};

const defaultReminders = [
  "Are you aware?",
  "Breathe deeply. This is the present moment.",
  "Take a moment to pause, and come back to the present.",
  "Bring awareness into this moment.",
  "Let go of greed, aversion, and delusion.",
  "Respond, not react.",
  "All of this is impermanent.",
  "Accept the feeling of what is happening in this moment. Don't struggle against it. Instead, notice it. Take it in.",
  "RAIN: Recognize / Allow / Invesigate with interest and care / Nurture with self-compassion",
  "Note any feeling tones in the moment: Pleasant / Unpleasant / Neutral.",
  "What is the attitude in the mind right now?",
  "May you be happy. May you be healthy. May you be free from harm. May you be peaceful.",
  '"Whatever it is that has the nature to arise will also pass away; therefore, there is nothing to want." -- Joseph Goldstein',
  '"Sitting quietly, Doing nothing, Spring comes, and the grass grows, by itself." -- Bashō',
];

export const defaultJsonReminderMap: JsonReminder[] = [
  {
    text: "Are you aware?",
    enabled: true,
    tag: defaultTagName,
    favourite: false,
  },
  {
    text: "Breathe deeply. This is the present moment.",
    enabled: true,
    tag: defaultTagName,
    favourite: false,
  },
  {
    text: "Take a moment to pause, and come back to the present.",
    enabled: true,
    tag: defaultTagName,
    favourite: false,
  },
  {
    text: "Bring awareness into this moment.",
    enabled: true,
    tag: defaultTagName,
    favourite: false,
  },
  {
    text: "Let go of greed, aversion, and delusion.",
    enabled: true,
    tag: defaultTagName,
    favourite: false,
  },
  {
    text: "Respond, not react.",
    enabled: true,
    tag: defaultTagName,
    favourite: false,
  },
  {
    text: "All of this is impermanent.",
    enabled: true,
    tag: defaultTagName,
    favourite: false,
  },
  {
    text: "Accept the feeling of what is happening in this moment. Don't struggle against it. Instead, notice it. Take it in.",
    enabled: true,
    tag: defaultTagName,
    favourite: false,
  },
  {
    text: "RAIN: Recognize / Allow / Invesigate with interest and care / Nurture with self-compassion",
    enabled: false,
    tag: defaultTagName,
    favourite: false,
  },
  {
    text: "Note any feeling tones in the moment: Pleasant / Unpleasant / Neutral.",
    enabled: true,
    tag: defaultTagName,
    favourite: false,
  },
  {
    text: "What is the attitude in the mind right now?",
    enabled: true,
    tag: defaultTagName,
    favourite: false,
  },
  {
    text: "May you be happy. May you be healthy. May you be free from harm. May you be peaceful.",
    enabled: true,
    tag: defaultTagName,
    favourite: false,
  },
  {
    text: '"Whatever it is that has the nature to arise will also pass away; therefore, there is nothing to want." -- Joseph Goldstein',
    enabled: true,
    tag: defaultTagName,
    favourite: false,
  },
  {
    text: '"Sitting quietly, Doing nothing, Spring comes, and the grass grows, by itself." -- Bashō',
    enabled: true,
    tag: defaultTagName,
    favourite: false,
  },
];
