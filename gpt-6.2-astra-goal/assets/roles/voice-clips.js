'use strict';
const roleSpeech = {
  "herbalist-window": [
    "Травница Мара",
    "Сними фонарь с окна. Дети ещё на тропе. Со стороны дороги их видно.",
    "./assets/roles/herbalist-window.mp3",
    5.517
  ],
  "scout-tracks": [
    "Дозорная Лиора",
    "У опушки двое. Глянь на плащи. Один из дворцовой стражи, другой пришёл из форта.",
    "./assets/roles/scout-tracks.mp3",
    6.505
  ],
  "scout-home": [
    "Дозорная Лиора",
    "Я уведу детей за овраг. А ты держи тропу у домов, пока не пройдёт последний.",
    "./assets/roles/scout-home.mp3",
    5.379
  ],
  "sentry-token": [
    "Часовой Ивен",
    "У ворот двое без сменных знаков. Назвались гонцами, а лошадей оставили в лесу.",
    "./assets/roles/sentry-token.mp3",
    5.453
  ],
  "captain-gate": [
    "Капитан Арда",
    "Если впустим обоих, один отвлечёт караул, а другой отопрёт створки. Мы подождём их здесь.",
    "./assets/roles/captain-gate.mp3",
    7.082
  ],
  "captain-report": [
    "Капитан Арда",
    "Подойди ко мне за приказом. После развода я останусь на площади, у дороги к дворцу.",
    "./assets/roles/captain-report.mp3",
    5.921
  ],
  "centurion-sacks": [
    "Сотник Гарт",
    "В обозе было зерно на весь гарнизон. Имперская стража сняла мешки и ушла к дворцу.",
    "./assets/roles/centurion-sacks.mp3",
    5.663
  ],
  "lord-banner": [
    "Владыка форта",
    "Разверни знамя, Гарт. Дружину поведу я. Нам пора спуститься с перевала.",
    "./assets/roles/lord-banner.mp3",
    7.075
  ],
  "centurion-march": [
    "Сотник Гарт",
    "В строю трое. Дворец или лесное поселение? Тебе выбирать.",
    "./assets/roles/centurion-march.mp3",
    4.691
  ]
};
realmVoice.register(Object.values(roleSpeech));
const roleMouth = {
  "herbalist-window": "EIGCVYYZZYTGFXXYXXYXOJINUGGDQQOLJBAAAAAAAAAIMMNZZPFGUTRTPRPJZZYVVKFLSXNFDOONGBAAAAAAAAAEHFTULICEYXWXVWYZWPWZZRWYZQLRVQQHFDEJQWXSJKMMMGBAAA",
  "scout-tracks": "ARWZZZPGFQZXLNFETWSRPNQZWWVSPMHBAAAAAAAACMOWVYZZWSTTYZRFMZZZUMNNNJRPKCAAAAAAAAAOVYZRJOUSUVOKKPXZTJEFFUYWRYTHFBFQUVTSLIRNJNTZSKPYYWGEOWPJKHRVWTTOGFCBCXWVPHBAJLIDAAA",
  "scout-home": "AGHKWZZXUYXOPVTNRVRKMPICFQVXQHRXZZWMTRUSOFBDBAAAAAAAAETYQGTYQJXZTOMRZLFTYZTFEPXWXRNYZSPUWUIDCSZKEOYVSSQELUZXXJTVSEBDXPGFEKRXTQHLLKGAAAA",
  "sentry-token": "AQUKYXSZXMEKPNQZZZZVNXVQSRJPVYXVVVVHJMHUVVTJBGOFCBAAAAAAAAAPVYRMPPZZVUYNLCRYVSLPHVVTPPPLHAAAAIWXZYOPLSOKOZZZVNNEGWWXRXWTXPQRSSNPJLQMHBAAA",
  "captain-gate": "AMMNVZRLHJUGCAEXZULFFIUUVVTNNXZZZYVMGEBAAAAAAAAJTWMJWZZVSRDDOTXHMJZXHCFJVSWXXUWRMEAAAAAAAAGUXORVXPJTZZXMPREQNCDOUVSEFEAEARXSNGCAEHHCAAAAAACRWXUEGZXMZZXPPOMZZYZSQQFEGEEDUVNHHGBAAA",
  "captain-report": "BSYOYZZZOKWZIDJZYYZXYYQOZMDNWWEGLWVTOHKNKGAAAAAAACSZZMKGRZOXYTLPMUYZQRYQHKSSQRLGBBVYUQQNHEFPQEBKUZZXONNLNGGJFAAAAAAAATWNTYVSWZTHTIFKOLXWLGCEEDPIEAAAA",
  "centurion-sacks": "AKOZZRNZZZPQZSQUYYYYOKRXSTXZYVXYUSWQJEHUZOSVWVOJLUUSOJEAAAAAAAAAAGWZXOCHZZRIGDFTYTJEAGTXYYONUOHFEUVUWXWXXURMJBEPXXUVTNLGKWWLEHPTVNIADEHNLHCAAA",
  "lord-banner": "APPOTUURRQPSYWSSXZXWZZUOUZZZZWQRRSSQLIIKONMJFCCBAAAAAAAAAAEPRSUOSUWUVVVXZZUUZZSMLKSTRNRQRRTVWWSLJGDAAAAAAAAAARRTUVVRQQMKKYXUSWWVRLNKCBCRPPOKGFHYZKKMKQTPNNLDCIWQUVRPTWWQLHFDAAAAA",
  "centurion-march": "ABGFAEUYZYYWKCNSYZZXTPKDAAAAAAAAAAOTTQXZYTZZMDEHXVWXVWTKGCLWZYVLDTUJHHVVUYXWXXWVRJDAAAAAAAAAADXXQTZYSZWQNZYUZXSFCCAAAA"
};
