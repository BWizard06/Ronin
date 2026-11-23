export const details = [
  { id:'silhouette', name:'Sugata', kanji:'姿', meaning:'The complete form',
    paragraphs:['One continuous curve. Four distinct parts. The character of a Japanese sword begins with its proportions, long before the smallest ornament.','Steel, woven cord and lacquer catch the light differently. Together they give this silhouette its balance.'],
    source:'Japan Cultural Expo', href:'https://japanculturalexpo.ntj.jac.go.jp/en/article/feature/202503/' },
  { id:'hamon', name:'Hamon', kanji:'刃文', meaning:'A pattern revealed by hardening',
    paragraphs:['The pale line along the edge marks the boundary created by differential hardening. Polishing reveals its shape.','A maker can give this line a distinct rhythm. Here, moving the light reveals the contrast between the edge and the body of the blade.'],
    source:'Japan Cultural Expo', href:'https://japanculturalexpo.ntj.jac.go.jp/en/article/feature/202503/' },
  { id:'grip', name:'Tsuka', kanji:'柄', meaning:'The point of contact',
    paragraphs:['Dark bands cross over a crimson underlay. The raised weave absorbs light, creating a tactile counterpoint to the polished steel.','The rhythm comes from one band passing over the next. Small metal fittings frame the wrap at either end.'],source:'',href:'' },
  { id:'guard', name:'Tsuba', kanji:'鍔', meaning:'A small surface for expression',
    paragraphs:['Between blade and grip, the guard becomes a place for metalwork. Nature, family emblems and stories have all found their way onto this small surface.','The waves in this design are a contemporary interpretation. Their contours change as light passes over the relief.'],source:'RISD Museum',href:'https://risdmuseum.org/exhibitions-events/exhibitions/tsuba' },
  { id:'saya', name:'Saya', kanji:'鞘', meaning:'The quiet counterpart',
    paragraphs:['A smooth lacquer surface follows the curve of the blade. Its crimson motif sits within the finish, beneath one continuous reflection.','The cord provides the contrast. Matte fibres interrupt the soft sheen of the lacquer and the warmth of the metal fittings.'],source:'',href:'' },
];

export const steels = [
  {name:'Tamahagane',kanji:'玉鋼',role:'The starting material',body:'Steel produced from iron sand in a tatara furnace. Its carbon content varies, so the smith selects and combines pieces for different roles in the blade.',note:'Selection comes before construction.'},
  {name:'Kawagane',kanji:'皮鉄',role:'The harder outer steel',body:'Steel with more carbon forms the outer jacket in this traditional arrangement. It can support a hard cutting edge while the softer core sits inside it.',note:'An outer layer chosen for hardness.'},
  {name:'Shingane',kanji:'心鉄',role:'The softer core',body:'Steel with less carbon forms the inner core. Together with the outer jacket, it balances the different material properties within a single blade.',note:'A core chosen for toughness.'},
];

export const eras = [
  { year: '1000', date: 'c. 1000', period: 'Heian', title: 'The curve takes shape.',
    body: 'The tachi belongs to an earlier chapter of the Japanese sword. Surviving examples show pronounced curvature and highly individual proportions. One celebrated blade, Mikazuki Munechika, takes its name from crescent shaped patterns in its hardened edge.',
    note: 'A useful distinction: the history of the Japanese sword begins long before the katana.',
    source: 'Tokyo National Museum', href: 'https://emuseum.nich.go.jp/detail?content_base_id=100192&content_part_id=0&content_pict_id=0&langId=en&webView=' },
  { year: '1200', date: '13th c.', period: 'Kamakura', title: 'Craft finds its schools.',
    body: 'Kyoto’s Yamashiro tradition flourished through the Heian and Kamakura periods. A sword can reveal the preferences of a region and a lineage of makers through its shape and workmanship. There was never just one universal Japanese blade.',
    note: 'Look for differences in proportion, surface and the pattern along the edge.',
    source: 'Kyoto National Museum', href: 'https://www.kyohaku.go.jp/old/eng/special/koremade/katana_2018.html' },
  { year: '1500', date: '15th to 16th c.', period: 'Muromachi', title: 'A different way to wear it.',
    body: 'A tachi hangs from the waist with its cutting edge facing down. A katana is worn through the sash with the edge facing up. The distinction is about mounting and use as well as the blade itself; the two terms are not interchangeable.',
    note: 'The katana becomes familiar through the relationship between the object and its wearer.',
    source: 'National Gallery of Victoria', href: 'https://www.ngv.vic.gov.au/wp-content/uploads/2014/12/BUSHIDO_Wall-Texts.pdf#page=16' },
  { year: '1603', date: '1603 to 1868', period: 'Edo', title: 'A surface for expression.',
    body: 'During the Edo period, hamon became increasingly expressive. Some patterns even evoked Mount Fuji or cherry blossoms. Sword appreciation extended beyond the blade to the choices of the craftspeople responsible for its fittings.',
    note: 'The smallest details can carry as much character as the complete silhouette.',
    source: 'Japan Cultural Expo', href: 'https://japanculturalexpo.ntj.jac.go.jp/en/article/feature/202503/' },
  { year: '1948', date: '1948 to today', period: 'Preservation', title: 'A craft carried forward.',
    body: 'Founded in 1948, the NBTHK works to preserve Japanese art swords. Its remit also includes the skills behind them: forging, polishing and making the mountings. Preservation concerns both the surviving objects and the knowledge needed to understand and care for them.',
    note: 'The story continues in workshops, collections and museums.',
    source: 'The Japanese Sword Museum', href: 'https://www.touken.or.jp/english/aboutus.html' },
];

export const culture = [
  { title: 'A threshold.', name: 'Torii', body: 'A torii marks the boundary between a Shinto shrine’s sacred space and the everyday world outside. Passing through it signals a change of space and of attention.', source: 'Jinja Honcho', href: 'https://www.jinjahoncho.or.jp/en/at-a-jinja/entering/' },
  { title: 'A passing season.', name: 'Sakura', body: 'Hanami is the practice of flower viewing, closely associated with cherry blossoms. Their brief flowering invites people to stop and appreciate something that will soon change.', source: 'Japan National Tourism Organization', href: 'https://www.japan.travel/en/ca/sakura-cherry-blossom/' },
];
