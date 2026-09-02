export type SubtitlePhrase = {
  from: number;
  to: number;
  text: string;
  // index of the word (split by space) to render in accent color, or -1 for none
  emphasisIndex: number;
};

export const SUBTITLES: SubtitlePhrase[] = [
  { from: 0, to: 22, text: "Ваш бизнес", emphasisIndex: -1 },
  { from: 22, to: 63, text: "всё ещё выкладывает", emphasisIndex: -1 },
  { from: 63, to: 110, text: "обычные скучные видео?", emphasisIndex: 1 },

  { from: 110, to: 143, text: "Пока конкуренты", emphasisIndex: 1 },
  { from: 143, to: 178, text: "цепляют внимание", emphasisIndex: 0 },
  { from: 178, to: 213, text: "с первых секунд,", emphasisIndex: -1 },
  { from: 213, to: 269, text: "используют мощную графику,", emphasisIndex: 1 },
  { from: 269, to: 317, text: "динамику и современные", emphasisIndex: 0 },
  { from: 317, to: 347, text: "AI-технологии,", emphasisIndex: 0 },
  { from: 347, to: 403, text: "ваши клиенты просто", emphasisIndex: -1 },
  { from: 403, to: 451, text: "листают дальше.", emphasisIndex: 0 },

  { from: 451, to: 501, text: "Я создаю рилс под ключ,", emphasisIndex: 2 },
  { from: 501, to: 557, text: "придумываю цепляющую идею,", emphasisIndex: 2 },
  { from: 557, to: 587, text: "пишу сценарий,", emphasisIndex: 1 },
  { from: 587, to: 639, text: "создаю уникальный визуал", emphasisIndex: 1 },
  { from: 639, to: 667, text: "с помощью ИИ,", emphasisIndex: 2 },
  { from: 667, to: 741, text: "добавляю озвучку,", emphasisIndex: 1 },
  { from: 741, to: 780, text: "монтаж и субтитры.", emphasisIndex: 0 },

  { from: 780, to: 836, text: "Вам не нужно тратить время", emphasisIndex: -1 },
  { from: 836, to: 855, text: "на съёмки", emphasisIndex: 1 },
  { from: 855, to: 903, text: "и придумывать контент.", emphasisIndex: -1 },

  { from: 903, to: 958, text: "Вы получаете готовые рилс,", emphasisIndex: 2 },
  { from: 958, to: 1016, text: "которые выделяют бизнес", emphasisIndex: 1 },
  { from: 1016, to: 1063, text: "и удерживают внимание.", emphasisIndex: 1 },

  { from: 1063, to: 1118, text: "Хотите контент,", emphasisIndex: -1 },
  { from: 1118, to: 1160, text: "который выглядит современно", emphasisIndex: 2 },
  { from: 1160, to: 1193, text: "и цепляет людей?", emphasisIndex: 1 },
  { from: 1193, to: 1221, text: "Напишите мне,", emphasisIndex: 0 },
  { from: 1221, to: 1252, text: "и создадим ваш", emphasisIndex: -1 },
  { from: 1252, to: 1306, text: "вирусный ролик.", emphasisIndex: 0 },
];
