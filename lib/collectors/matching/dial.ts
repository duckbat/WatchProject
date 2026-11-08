const dialColors =
  'black|white|blue|green|silver|grey|gray|champagne|brown|pink|purple|red|orange|yellow|salmon|turquoise|beige|ivory|slate|rhodium|anthracite|cream|coral';

const nordicDialWords: Record<string, string> = {
  svart: 'black',
  sort: 'black',
  musta: 'black',
  vit: 'white',
  hvit: 'white',
  hvid: 'white',
  valkoinen: 'white',
  blå: 'blue',
  blått: 'blue',
  sininen: 'blue',
  grön: 'green',
  grönt: 'green',
  grønn: 'green',
  grøn: 'green',
  vihreä: 'green',
  grå: 'grey',
  harmaa: 'grey',
  sølv: 'silver',
  rosa: 'pink',
  roosa: 'pink',
  röd: 'red',
  rød: 'red',
  punainen: 'red',
  gul: 'yellow',
  keltainen: 'yellow',
  brun: 'brown',
  ruskea: 'brown',
  turkos: 'turquoise',
  turkoosi: 'turquoise',
  lila: 'purple',
  lilla: 'purple',
  violetti: 'purple',
  urtavla: 'dial',
  urskive: 'dial',
};

const dialText = (text: string) => text.replace(/\p{L}+/gu, (w) => nordicDialWords[w.toLowerCase()] || w);

// shortcut: recognized dial colors only; use structured dial metadata when sources expose more detail.
export function expectedDial(name = '') {
  const expected = new Set<string>();
  for (const part of name.split('/').slice(1)) {
    if (/\b(gold|steel|case|bezel|bracelet|leather|rubber|strap|ceramic|titanium)\b/i.test(part)) continue;
    const color = part.trim().match(new RegExp(`^(${dialColors})\\b`, 'i'))?.[1];
    if (color) expected.add(color.toLowerCase().replace('gray', 'grey'));
  }
  return expected;
}

export function conflictingDial(text: string, name = '') {
  // Only compare explicit dial descriptions; a silver case or blue strap is not evidence of dial color.
  const expected = expectedDial(name);
  if (expected.size !== 1) return false;
  text = dialText(text);
  const before = new RegExp(
    `\\b(${dialColors})(?:[ -]+(?:sunburst|sunray|fluted|motif|palm|roman|diamond)){0,3}\\s+(?:dial|taulu)\\b`,
    'gi',
  );
  const after = new RegExp(`\\b(?:dial|taulu)\\s*[:=-]\\s*(${dialColors})\\b`, 'gi');
  const observed = [...text.matchAll(before), ...text.matchAll(after)].map((m) =>
    m[1].toLowerCase().replace('gray', 'grey'),
  );
  return observed.some((color) => !expected.has(color));
}

/** Dial colors a title names outside strap/bezel/case wording ("126200 Green Ombré", "Wimbledon"). */
const dialStyles = [
  'ombre',
  'palm',
  'motif',
  'roman',
  'diamond',
  'meteorite',
  'mother of pearl',
  'tiffany',
  'wimbledon',
];

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Colors a text names outside strap/bezel/case wording, Nordic words translated ("sininen" → blue, "Wimbledon" → slate). */
function namedDialColors(text: string) {
  const t = dialText(text)
    .toLowerCase()
    .replace(/\bwimbledon\b/g, 'slate');
  return [
    ...t.matchAll(
      new RegExp(
        `\\b(${dialColors})\\b(?!\\s*(?:-\\s*)?(?:strap|bracelet|bezel|case|hands|leather|rubber|nato|band|lume|box|rem|reim|armband|ranneke))`,
        'g',
      ),
    ),
  ].map((m) => m[1].replace('gray', 'grey'));
}

/** The text names this variant's dial color (and no other), e.g. "126200 blue" for "… / Blue / Oyster". */
export function namesDial(text: string, name = '') {
  const expected = expectedDial(name);
  if (expected.size !== 1) return false;
  const named = namedDialColors(text);
  return named.length > 0 && named.every((c) => expected.has(c));
}

export function titleDialConflict(title: string, name = '') {
  // A dial style the variant does not have ("Ombre", "Palm", "Roman") marks another variant of the same reference.
  if (name.includes('/')) {
    const n = fold(name),
      t = fold(title);
    if (dialStyles.some((st) => new RegExp(`\\b${st}`).test(t) && !n.includes(st === 'wimbledon' ? 'slate' : st)))
      return true;
  }
  const expected = expectedDial(name);
  if (expected.size !== 1) return false;
  return namedDialColors(title).some((c) => !expected.has(c));
}
