const BAD_WORDS = [
  'хуй', 'хуя', 'хуе', 'хуё', 'хуйня', 'хуйню', 'хуёвый', 'хуёво',
  'пизд', 'пизда', 'пиздец', 'пиздеть', 'пиздюк', 'пиздючка',
  'бля', 'блять', 'блядь', 'бляд', 'бляди', 'блядство',
  'еба', 'ебать', 'ёба', 'ебал', 'ебаный', 'ёбаный', 'ебу', 'ебёт',
  'жопа', 'жопу', 'жопный', 'жопой',
  'говно', 'говна', 'говнюк',
  'гнида', 'гнилой',
  'шлюха', 'шлюшка', 'шлюхой',
  'сука', 'сучка', 'сукин',
  'пидор', 'пидорас', 'пидоры',
  'мудак', 'мудила', 'мудозвон',
  'залупа', 'залупой',
  'член', 'члена',
  'вагина', 'вагину',
  'кака', 'какашка', 'какать',
  'hui', 'huya', 'hue', 'huio', 'huiny', 'huinyu', 'huiev',
  'pizd', 'pizda', 'pizdec', 'pizdet', 'pizduk',
  'blya', 'blyat', 'blyad', 'blyadi',
  'eba', 'ebat', 'yoba', 'ebal', 'ebaniy',
  'jopa', 'jopu',
  'govno', 'govna',
  'gnida',
  'shlyuha', 'shlyushka',
  'suka', 'suchka',
  'pidor', 'pidoras',
  'mudak', 'mudila',
  'zalupa',
  'chlen', 'chlena',
  'vagina',
  'kaka', 'kakashka',
  'xui', 'xyi', 'xyu', 'xuy', 'xuj', 'xuyaw', 'xuyak',
  'pizd0', 'pizd4', 'b1yat', 'bl9at', '3bat', 'yob4',
  'z4lupa', 'p1dor', 'mud4k', 'suk4', 'g0vno',
];

function normalize(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/0/g, 'o')
        .replace(/4/g, 'a')
        .replace(/1/g, 'i')
        .replace(/3/g, 'e')
        .replace(/@/g, 'a')
        .replace(/\$/g, 's')
        .replace(/[^a-zа-я]/g, '');
}

const NORMALIZED = [...new Set(BAD_WORDS.map(normalize).filter((w) => w.length >= 3))];

function containsBadWord(text) {
    const n = normalize(text);
    if (!n) return false;
    return NORMALIZED.some((w) => n.includes(w));
}

module.exports = { containsBadWord };
