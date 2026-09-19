import type { Azkar } from '@/types/azkar';
import { defineAzkar, fromQuran, REF_PENDING } from './_shared/define';
import { AL_FALAQ, AN_NAS, AYAT_AL_KURSI } from './_shared/quran';

/** ЗАЩИТНЫЕ ДУА. Мольбы о защите от вреда, зависти, шайтана и бед. */
export const protectionAzkar: Azkar[] = defineAzkar('protection', [
  {
    key: '01-kalimat-at-tammat',
    title: 'Прибегаю к совершенным словам Аллаха',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    transliteration: "А'узу би-калимати-Лляхи-т-таммати мин шарри ма халяк.",
    translation: 'Прибегаю к совершенным словам Аллаха от зла того, что Он сотворил.',
    repetitions: 3,
    source: { kind: 'hadith', collection: 'Сахих Муслим' },
    sourceDetails: 'Читается вечером, а также при остановке в незнакомом месте.',
    tags: ['защита', 'от вреда', 'путешествие'],
    verified: false,
    reviewNote: REF_PENDING,
  },
  {
    key: '02-la-yadurru',
    title: 'С именем Аллаха, с именем Которого ничто не навредит',
    arabic:
      'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ',
    transliteration:
      "Бисми-Лляхи-ллязи ля ядурру ма'а-смихи шайун фи-ль-арди ва ля фи-с-сама, ва Хуа-с-Сами'у-ль-'Алим.",
    translation:
      'С именем Аллаха, с именем Которого ничто не причинит вреда ни на земле, ни на небе, и Он — Слышащий, Знающий.',
    repetitions: 3,
    source: { kind: 'hadith', collection: 'Сунан ат-Тирмизи' },
    tags: ['защита', 'от вреда', 'утро', 'вечер'],
    verified: false,
    reviewNote: REF_PENDING,
  },
  {
    key: '03-hasbunallah',
    title: 'Достаточно нам Аллаха',
    arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
    transliteration: "Хасбуна-Ллаху ва ни'ма-ль-вакиль.",
    translation: 'Достаточно нам Аллаха, и как прекрасен этот Попечитель!',
    repetitions: 3,
    source: { kind: 'quran', collection: 'Коран', reference: '3:173' },
    sourceDetails: 'Часть аята 173 суры «Али Имран».',
    tags: ['защита', 'упование', 'страх', 'коран'],
    verified: true,
  },
  {
    key: '04-najaluka-fi-nuhurihim',
    title: 'Мольба против вражды',
    arabic:
      'اللَّهُمَّ إِنَّا نَجْعَلُكَ فِي نُحُورِهِمْ، وَنَعُوذُ بِكَ مِنْ شُرُورِهِمْ',
    transliteration: "Аллахумма, инна надж'алюка фи нухурихим, ва на'узу бика мин шурурихим.",
    translation:
      'О Аллах, мы делаем Тебя защитой от них и прибегаем к Тебе от их зла.',
    repetitions: 1,
    source: { kind: 'hadith', collection: 'Сунан Абу Дауда' },
    sourceDetails: 'Пророк ﷺ произносил это, опасаясь вреда от людей.',
    tags: ['защита', 'враги', 'страх'],
    verified: false,
    reviewNote: REF_PENDING,
  },
  {
    key: '05-hamazat-ash-shayatin',
    title: 'От наущений шайтанов',
    arabic:
      'رَّبِّ أَعُوذُ بِكَ مِنْ هَمَزَاتِ الشَّيَاطِينِ ۝ وَأَعُوذُ بِكَ رَبِّ أَن يَحْضُرُونِ',
    transliteration:
      "Рабби, а'узу бика мин хамазати-ш-шаятын. Ва а'узу бика, Рабби, ан яхдурун.",
    translation:
      'Господь мой, прибегаю к Тебе от наущений дьяволов, и прибегаю к Тебе, Господь мой, от того, чтобы они приближались ко мне.',
    repetitions: 1,
    source: { kind: 'quran', collection: 'Коран', reference: '23:97–98' },
    sourceDetails: 'Сура «аль-Муминун», аяты 97–98.',
    tags: ['защита', 'шайтан', 'наущения', 'коран'],
    verified: true,
  },
  {
    key: '06-uidhukuma',
    title: 'Защита для детей',
    arabic:
      'أُعِيذُكُمَا بِكَلِمَاتِ اللَّهِ التَّامَّةِ، مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ، وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ',
    transliteration:
      "У'изукума би-калимати-Лляхи-т-тамма, мин кулли шайтанин ва хамма, ва мин кулли 'айнин лямма.",
    translation:
      'Отдаю вас под защиту совершенных слов Аллаха от всякого шайтана, от всякого ядовитого существа и от всякого дурного глаза.',
    repetitions: 1,
    source: { kind: 'hadith', collection: 'Сахих аль-Бухари' },
    sourceDetails:
      'Пророк ﷺ читал это для аль-Хасана и аль-Хусейна. Для одного ребёнка окончания слов меняются — уточните форму у знающего человека.',
    tags: ['защита', 'дети', 'сглаз'],
    verified: false,
    reviewNote:
      'Проверьте номер хадиса и приведите корректные формы для единственного числа и для девочки.',
  },
  fromQuran(AYAT_AL_KURSI, {
    key: '07-ayat-al-kursi',
    repetitions: 1,
    tags: ['защита', 'коран', 'дом'],
  }),
  fromQuran(AL_FALAQ, {
    key: '08-al-falaq',
    repetitions: 3,
    tags: ['защита', 'коран', 'сглаз', 'зависть'],
  }),
  fromQuran(AN_NAS, {
    key: '09-an-nas',
    repetitions: 3,
    tags: ['защита', 'коран', 'наущения'],
  }),
]);

export default protectionAzkar;
