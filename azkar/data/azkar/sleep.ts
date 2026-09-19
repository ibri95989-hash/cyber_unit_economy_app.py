import type { Azkar } from '@/types/azkar';
import { defineAzkar, fromQuran, REF_PENDING } from './_shared/define';
import { AL_FALAQ, AL_IKHLAS, AN_NAS, AYAT_AL_KURSI, BAQARAH_LAST_TWO } from './_shared/quran';

/** АЗКАРЫ ПЕРЕД СНОМ. */
export const sleepAzkar: Azkar[] = defineAzkar('sleep', [
  {
    key: '01-bismika-amutu-wa-ahya',
    title: 'С именем Твоим я умираю и оживаю',
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    transliteration: 'Бисмика-Ллахумма амуту ва ахйа.',
    translation: 'С именем Твоим, о Аллах, я умираю и оживаю.',
    repetitions: 1,
    source: { kind: 'hadith', collection: 'Сахих аль-Бухари' },
    tags: ['сон', 'перед сном'],
    verified: false,
    reviewNote: REF_PENDING,
  },
  {
    key: '02-wadatu-janbi',
    title: 'С именем Твоим, Господь мой, я лёг на бок',
    arabic:
      'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ',
    transliteration:
      "Бисмика, Рабби, вада'ту джанби, ва бика арфа'ух. Фа-ин амсакта нафси фа-рхамха, ва ин арсальтаха фа-хфазха бима тахфазу бихи 'ибадака-с-салихин.",
    translation:
      'С именем Твоим, Господь мой, я лёг на бок и с Твоей помощью поднимусь. Если Ты заберёшь мою душу — помилуй её, а если отпустишь — храни её так, как хранишь Своих праведных рабов.',
    repetitions: 1,
    source: { kind: 'hadith', collection: 'Сахих аль-Бухари и Сахих Муслим' },
    tags: ['сон', 'перед сном', 'защита'],
    verified: false,
    reviewNote: REF_PENDING,
  },
  {
    key: '03-aslamtu-nafsi',
    title: 'Я предал себя Тебе',
    arabic:
      'اللَّهُمَّ أَسْلَمْتُ نَفْسِي إِلَيْكَ، وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَوَجَّهْتُ وَجْهِي إِلَيْكَ، وَأَلْجَأْتُ ظَهْرِي إِلَيْكَ، رَغْبَةً وَرَهْبَةً إِلَيْكَ، لَا مَلْجَأَ وَلَا مَنْجَا مِنْكَ إِلَّا إِلَيْكَ، آمَنْتُ بِكِتَابِكَ الَّذِي أَنْزَلْتَ، وَبِنَبِيِّكَ الَّذِي أَرْسَلْتَ',
    transliteration:
      "Аллахумма, аслямту нафси илейк, ва фаввадту амри илейк, ва ваджжахту ваджхи илейк, ва альджа'ту захри илейк, рагбатан ва рахбатан илейк. Ля мальджа'а ва ля манджа минка илля илейк. Аманту би-китабика-ллязи анзальт, ва би-набиййика-ллязи арсальт.",
    translation:
      'О Аллах, я предал себя Тебе, вверил Тебе своё дело, обратил к Тебе своё лицо и на Тебя положился — со стремлением к Тебе и страхом перед Тобой. Нет убежища и спасения от Тебя, кроме как у Тебя. Я уверовал в Твоё Писание, которое Ты ниспослал, и в Твоего пророка, которого Ты отправил.',
    repetitions: 1,
    source: { kind: 'hadith', collection: 'Сахих аль-Бухари и Сахих Муслим' },
    sourceDetails: 'Пророк ﷺ велел произносить это последними словами перед сном.',
    tags: ['сон', 'упование', 'вера'],
    verified: false,
    reviewNote: REF_PENDING,
  },
  fromQuran(AYAT_AL_KURSI, {
    key: '04-ayat-al-kursi',
    repetitions: 1,
    tags: ['сон', 'защита', 'коран'],
  }),
  fromQuran(AL_IKHLAS, {
    key: '05-al-ikhlas',
    repetitions: 3,
    tags: ['сон', 'защита', 'коран'],
  }),
  fromQuran(AL_FALAQ, {
    key: '06-al-falaq',
    repetitions: 3,
    tags: ['сон', 'защита', 'коран'],
  }),
  fromQuran(AN_NAS, {
    key: '07-an-nas',
    repetitions: 3,
    tags: ['сон', 'защита', 'коран'],
  }),
  fromQuran(BAQARAH_LAST_TWO, {
    key: '08-baqarah-last-two',
    repetitions: 1,
    tags: ['сон', 'защита', 'коран'],
  }),
  {
    key: '09-tasbih',
    title: 'Пречист Аллах',
    arabic: 'سُبْحَانَ اللَّهِ',
    transliteration: 'Субхана-Ллах.',
    translation: 'Пречист Аллах.',
    repetitions: 33,
    source: { kind: 'hadith', collection: 'Сахих аль-Бухари и Сахих Муслим' },
    sourceDetails:
      'Из хадиса о наставлении Фатиме, да будет доволен ею Аллах: 33 + 33 + 34 перед сном.',
    tags: ['сон', 'тасбих'],
    verified: false,
    reviewNote: REF_PENDING,
  },
  {
    key: '10-tahmid',
    title: 'Хвала Аллаху',
    arabic: 'الْحَمْدُ لِلَّهِ',
    transliteration: 'Аль-хамду ли-Лляh.',
    translation: 'Хвала Аллаху.',
    repetitions: 33,
    source: { kind: 'hadith', collection: 'Сахих аль-Бухари и Сахих Муслим' },
    tags: ['сон', 'хвала'],
    verified: false,
    reviewNote: REF_PENDING,
  },
  {
    key: '11-takbir',
    title: 'Аллах велик',
    arabic: 'اللَّهُ أَكْبَرُ',
    transliteration: 'Аллаху акбар.',
    translation: 'Аллах велик.',
    repetitions: 34,
    source: { kind: 'hadith', collection: 'Сахих аль-Бухари и Сахих Муслим' },
    tags: ['сон', 'такбир'],
    verified: false,
    reviewNote: REF_PENDING,
  },
  {
    key: '12-qini-adhabaka',
    title: 'Защити меня от Твоего наказания',
    arabic: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ',
    transliteration: "Аллахумма, кыни 'азабака йаума таб'асу 'ибадак.",
    translation: 'О Аллах, защити меня от Твоего наказания в День, когда Ты воскресишь Своих рабов.',
    repetitions: 3,
    source: { kind: 'hadith', collection: 'Сунан Абу Дауда' },
    sourceDetails: 'Передаётся также у ат-Тирмизи.',
    tags: ['сон', 'защита', 'судный день'],
    verified: false,
    reviewNote: REF_PENDING,
  },
]);

export default sleepAzkar;
