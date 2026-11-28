// The devotions' texts: Via Petri, Angelus (and Regina Caeli), the Chaplet of Divine Mercy.
// A devotion is a list of blocks, drawn by web/js/devotions.js:
//   { h: text }               a heading (Latin beside the translation)
//   { rubric: text }          an instruction, in the language of the app only
//   { prayer: text }          a prayer (Latin beside the translation); ℣. ℟. and new lines kept
//   { reading: 'vp1' }        a passage of Scripture (web/js/devotions/readings.js)
//   { prayers: ['pater', …] } the full common prayers, folded (for those who don't know them by heart)
// A text is { la, en, de, fr, es, pt }. Names the reader asked to keep in Latin (Via Petri,
// Angelus, Regina Caeli) are the same in every language.
import { AVE, CREDO, GLORIA, NAMES, PATER, SIGNUM } from './prayers.js';

const same = (s) => ({ la: s, en: s, de: s, fr: s, es: s, pt: s });

/* ---------------- Via Petri ---------------- */

const STATIONS = [
  ['vp1', { la: 'Iesus vocat Petrum', en: 'Jesus calls Peter', de: 'Jesus beruft Petrus', fr: 'Jésus appelle Pierre', es: 'Jesús llama a Pedro', pt: 'Jesus chama Pedro' }],
  ['vp2', { la: 'Petrus super aquas ambulat', en: 'Peter walks on the water', de: 'Petrus geht auf dem Wasser', fr: 'Pierre marche sur les eaux', es: 'Pedro camina sobre las aguas', pt: 'Pedro caminha sobre as águas' }],
  ['vp3', { la: 'Petrus Christum confitetur et claves accipit', en: 'Peter confesses Christ and receives the keys', de: 'Petrus bekennt Christus und empfängt die Schlüssel', fr: 'Pierre confesse le Christ et reçoit les clefs', es: 'Pedro confiesa a Cristo y recibe las llaves', pt: 'Pedro confessa Cristo e recebe as chaves' }],
  ['vp4', { la: 'Iesus lavat pedes Petri', en: 'Jesus washes Peter’s feet', de: 'Jesus wäscht Petrus die Füße', fr: 'Jésus lave les pieds de Pierre', es: 'Jesús lava los pies a Pedro', pt: 'Jesus lava os pés de Pedro' }],
  ['vp5', { la: 'Petrus in Gethsemani dormit', en: 'Peter sleeps in Gethsemane', de: 'Petrus schläft in Getsemani', fr: 'Pierre s’endort à Gethsémani', es: 'Pedro duerme en Getsemaní', pt: 'Pedro dorme no Getsêmani' }],
  ['vp6', { la: 'Petrus Iesum negat et flet amare', en: 'Peter denies Jesus and weeps bitterly', de: 'Petrus verleugnet Jesus und weint bitterlich', fr: 'Pierre renie Jésus et pleure amèrement', es: 'Pedro niega a Jesús y llora amargamente', pt: 'Pedro nega Jesus e chora amargamente' }],
  ['vp7', { la: 'Petrus ad monumentum vacuum', en: 'Peter at the empty tomb', de: 'Petrus am leeren Grab', fr: 'Pierre au tombeau vide', es: 'Pedro ante el sepulcro vacío', pt: 'Pedro diante do sepulcro vazio' }],
  ['vp8', { la: '«Pasce oves meas»', en: '“Feed my sheep”', de: '„Weide meine Schafe!“', fr: '« Pais mes brebis »', es: '«Apacienta mis ovejas»', pt: '«Apascenta as minhas ovelhas»' }],
  ['vp9', { la: 'Petrus in die Pentecostes praedicat', en: 'Peter preaches on the day of Pentecost', de: 'Petrus predigt am Pfingsttag', fr: 'Pierre prêche le jour de la Pentecôte', es: 'Pedro predica el día de Pentecostés', pt: 'Pedro prega no dia de Pentecostes' }],
  ['vp10', { la: 'Petrus claudum sanat', en: 'Peter heals the lame man', de: 'Petrus heilt den Gelähmten', fr: 'Pierre guérit le boiteux', es: 'Pedro cura al cojo', pt: 'Pedro cura o coxo' }],
  ['vp11', { la: 'Angelus Petrum e carcere liberat', en: 'An angel frees Peter from prison', de: 'Ein Engel befreit Petrus aus dem Kerker', fr: 'Un ange délivre Pierre de la prison', es: 'Un ángel libra a Pedro de la cárcel', pt: 'Um anjo liberta Pedro da prisão' }],
  ['vp12', { la: 'Petrus Christum usque ad martyrium sequitur', en: 'Peter follows Christ to martyrdom', de: 'Petrus folgt Christus bis ins Martyrium', fr: 'Pierre suit le Christ jusqu’au martyre', es: 'Pedro sigue a Cristo hasta el martirio', pt: 'Pedro segue Cristo até o martírio' }],
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const numbered = (n, text) => Object.fromEntries(Object.entries(text).map(([l, s]) => [l, `${ROMAN[n]}. ${s}`]));

const TU_ES_PETRUS = {
  la: '℣. Tu es Petrus,\n℟. Et super hanc petram aedificabo Ecclesiam meam.',
  en: '℣. Thou art Peter,\n℟. And upon this rock I will build my Church.',
  de: '℣. Du bist Petrus,\n℟. und auf diesen Felsen will ich meine Kirche bauen.',
  fr: '℣. Tu es Pierre,\n℟. et sur cette pierre je bâtirai mon Église.',
  es: '℣. Tú eres Pedro,\n℟. y sobre esta piedra edificaré mi Iglesia.',
  pt: '℣. Tu és Pedro,\n℟. e sobre esta pedra edificarei a minha Igreja.',
};

const AT_EACH = {
  la: 'Pater noster. Ave Maria. Gloria Patri.\n℣. Ora pro nobis, sancte Petre.\n℟. Ut digni efficiamur promissionibus Christi.',
  en: 'Our Father. Hail Mary. Glory be.\n℣. Pray for us, St Peter.\n℟. That we may be made worthy of the promises of Christ.',
  de: 'Vater unser. Gegrüßet seist du, Maria. Ehre sei dem Vater.\n℣. Bitte für uns, heiliger Petrus.\n℟. Auf dass wir würdig werden der Verheißungen Christi.',
  fr: 'Notre Père. Je vous salue, Marie. Gloire au Père.\n℣. Priez pour nous, saint Pierre.\n℟. Afin que nous devenions dignes des promesses du Christ.',
  es: 'Padre nuestro. Ave María. Gloria.\n℣. Ruega por nosotros, san Pedro.\n℟. Para que seamos dignos de alcanzar las promesas de Cristo.',
  pt: 'Pai nosso. Ave Maria. Glória ao Pai.\n℣. Rogai por nós, São Pedro.\n℟. Para que sejamos dignos das promessas de Cristo.',
};

// The Collect of St Peter's Chair (Roman Missal).
const DEUS_QUI_PETRO = {
  la: 'Deus, qui beato Petro Apostolo tuo, collatis clavibus regni caelestis, ligandi atque solvendi pontificium tradidisti: concede; ut, intercessionis eius auxilio, a peccatorum nostrorum nexibus liberemur. Qui vivis et regnas cum Deo Patre in unitate Spiritus Sancti Deus, per omnia saecula saeculorum.\n℟. Amen.',
  en: 'O God, who, by delivering to thy blessed Apostle Peter the keys of the kingdom of heaven, didst confer on him the power of binding and loosing: grant that, by the help of his intercession, we may be set free from the bonds of our sins. Who livest and reignest with God the Father in the unity of the Holy Ghost, God, world without end.\n℟. Amen.',
  de: 'Gott, du hast deinem heiligen Apostel Petrus die Schlüssel des Himmelreiches übergeben und ihm die Gewalt verliehen, zu binden und zu lösen: gewähre, dass wir durch die Hilfe seiner Fürbitte von den Fesseln unserer Sünden befreit werden. Der du lebst und herrschest mit Gott dem Vater in der Einheit des Heiligen Geistes, Gott, von Ewigkeit zu Ewigkeit.\n℟. Amen.',
  fr: 'Ô Dieu, qui, en remettant à votre bienheureux Apôtre Pierre les clefs du royaume céleste, lui avez conféré le pouvoir de lier et de délier : accordez-nous d’être délivrés, par le secours de son intercession, des liens de nos péchés. Vous qui vivez et régnez avec Dieu le Père, en l’unité du Saint-Esprit, Dieu, dans les siècles des siècles.\n℟. Amen.',
  es: 'Oh Dios, que, al entregar a tu bienaventurado Apóstol Pedro las llaves del reino de los cielos, le confiaste el poder de atar y desatar: concédenos que, por el auxilio de su intercesión, seamos librados de las ataduras de nuestros pecados. Tú que vives y reinas con Dios Padre en la unidad del Espíritu Santo, Dios, por los siglos de los siglos.\n℟. Amén.',
  pt: 'Ó Deus, que, entregando ao vosso bem-aventurado Apóstolo Pedro as chaves do reino dos céus, lhe conferistes o poder de ligar e desligar: concedei-nos que, pelo auxílio da sua intercessão, sejamos livres dos laços dos nossos pecados. Vós que viveis e reinais com Deus Pai, na unidade do Espírito Santo, Deus, por todos os séculos dos séculos.\n℟. Amém.',
};

const H = {
  opening: { la: 'Initium', en: 'Opening', de: 'Eröffnung', fr: 'Ouverture', es: 'Inicio', pt: 'Abertura' },
  closing: { la: 'Conclusio', en: 'Closing prayer', de: 'Schlussgebet', fr: 'Prière finale', es: 'Oración final', pt: 'Oração final' },
  prayers: { la: 'Orationes', en: 'The prayers', de: 'Die Gebete', fr: 'Les prières', es: 'Las oraciones', pt: 'As orações' },
};

export const VIA_PETRI = [
  { rubric: {
    la: 'Duodecim stationes de vita sancti Petri, a vocatione eius ad mare Galilaeae usque ad martyrium, ad modum Viae Crucis. In unaquaque statione legitur locus Scripturae, fit breve silentium, deinde dicuntur Pater noster, Ave Maria et Gloria Patri.',
    en: 'Twelve stations on the life of St Peter, from his call by the Sea of Galilee to his martyrdom, after the manner of the Stations of the Cross. At each station, read the passage of Scripture, pause for a moment in silence, then pray an Our Father, a Hail Mary and a Glory be.',
    de: 'Zwölf Stationen aus dem Leben des heiligen Petrus, von seiner Berufung am See von Galiläa bis zu seinem Martyrium, nach dem Vorbild des Kreuzwegs. Bei jeder Station die Schriftstelle lesen, einen Augenblick in Stille verweilen, dann ein Vater unser, ein Gegrüßet seist du, Maria und ein Ehre sei dem Vater beten.',
    fr: 'Douze stations sur la vie de saint Pierre, de son appel au bord de la mer de Galilée jusqu’à son martyre, à la manière du chemin de croix. À chaque station, lire le passage de l’Écriture, faire un moment de silence, puis dire un Notre Père, un Je vous salue Marie et un Gloire au Père.',
    es: 'Doce estaciones de la vida de san Pedro, desde su llamada a orillas del mar de Galilea hasta su martirio, a la manera del Vía Crucis. En cada estación, leer el pasaje de la Escritura, guardar un momento de silencio y rezar un Padre nuestro, un Ave María y un Gloria.',
    pt: 'Doze estações da vida de São Pedro, desde o seu chamado junto ao mar da Galileia até o seu martírio, à maneira da Via-Sacra. Em cada estação, ler a passagem da Escritura, fazer um momento de silêncio e rezar um Pai-nosso, uma Ave-Maria e um Glória.',
  } },
  { h: H.opening },
  { prayer: SIGNUM },
  { prayer: TU_ES_PETRUS },
  ...STATIONS.flatMap(([id, title], n) => [{ h: numbered(n, title), station: true }, { reading: id }, { prayer: AT_EACH }]),
  { h: H.closing },
  { prayer: { ...NAMES.oremus } },
  { prayer: DEUS_QUI_PETRO },
  { prayer: SIGNUM },
  { h: H.prayers },
  { prayers: ['pater', 'ave', 'gloria'] },
  { sources: true },
];

/* ---------------- Angelus and Regina Caeli ---------------- */

const vr = (o) => o; // (a ℣./℟. pair: kept as written)

export const ANGELUS = [
  { prayer: vr({
    la: '℣. Angelus Domini nuntiavit Mariae.\n℟. Et concepit de Spiritu Sancto.',
    en: '℣. The Angel of the Lord declared unto Mary.\n℟. And she conceived of the Holy Ghost.',
    de: '℣. Der Engel des Herrn brachte Maria die Botschaft,\n℟. und sie empfing vom Heiligen Geist.',
    fr: '℣. L’Ange du Seigneur annonça à Marie,\n℟. Et elle conçut du Saint-Esprit.',
    es: '℣. El Ángel del Señor anunció a María.\n℟. Y concibió por obra del Espíritu Santo.',
    pt: '℣. O Anjo do Senhor anunciou a Maria.\n℟. E ela concebeu do Espírito Santo.',
  }) },
  { prayer: AVE },
  { prayer: vr({
    la: '℣. Ecce ancilla Domini.\n℟. Fiat mihi secundum verbum tuum.',
    en: '℣. Behold the handmaid of the Lord.\n℟. Be it done unto me according to thy word.',
    de: '℣. Maria sprach: Siehe, ich bin die Magd des Herrn,\n℟. mir geschehe nach deinem Wort.',
    fr: '℣. Voici la servante du Seigneur,\n℟. Qu’il me soit fait selon votre parole.',
    es: '℣. He aquí la esclava del Señor.\n℟. Hágase en mí según tu palabra.',
    pt: '℣. Eis aqui a serva do Senhor.\n℟. Faça-se em mim segundo a vossa palavra.',
  }) },
  { prayer: AVE },
  { prayer: vr({
    la: '℣. Et Verbum caro factum est.\n℟. Et habitavit in nobis.',
    en: '℣. And the Word was made flesh.\n℟. And dwelt among us.',
    de: '℣. Und das Wort ist Fleisch geworden\n℟. und hat unter uns gewohnt.',
    fr: '℣. Et le Verbe s’est fait chair,\n℟. Et il a habité parmi nous.',
    es: '℣. Y el Verbo se hizo carne.\n℟. Y habitó entre nosotros.',
    pt: '℣. E o Verbo se fez carne.\n℟. E habitou entre nós.',
  }) },
  { prayer: AVE },
  { prayer: vr({
    la: '℣. Ora pro nobis, sancta Dei Genetrix.\n℟. Ut digni efficiamur promissionibus Christi.',
    en: '℣. Pray for us, O holy Mother of God.\n℟. That we may be made worthy of the promises of Christ.',
    de: '℣. Bitte für uns, heilige Gottesmutter,\n℟. auf dass wir würdig werden der Verheißungen Christi.',
    fr: '℣. Priez pour nous, sainte Mère de Dieu,\n℟. Afin que nous devenions dignes des promesses du Christ.',
    es: '℣. Ruega por nosotros, santa Madre de Dios.\n℟. Para que seamos dignos de alcanzar las promesas de Cristo.',
    pt: '℣. Rogai por nós, santa Mãe de Deus.\n℟. Para que sejamos dignos das promessas de Cristo.',
  }) },
  { prayer: { ...NAMES.oremus } },
  { prayer: {
    la: 'Gratiam tuam, quaesumus, Domine, mentibus nostris infunde: ut qui, Angelo nuntiante, Christi Filii tui incarnationem cognovimus, per passionem eius et crucem ad resurrectionis gloriam perducamur. Per eundem Christum Dominum nostrum.\n℟. Amen.',
    en: 'Pour forth, we beseech thee, O Lord, thy grace into our hearts; that we, to whom the Incarnation of Christ thy Son was made known by the message of an Angel, may by his Passion and Cross be brought to the glory of his Resurrection. Through the same Christ our Lord.\n℟. Amen.',
    de: 'Allmächtiger Gott, gieße deine Gnade in unsere Herzen ein. Durch die Botschaft des Engels haben wir die Menschwerdung Christi, deines Sohnes, erkannt. Lass uns durch sein Leiden und Kreuz zur Herrlichkeit der Auferstehung gelangen. Durch denselben Christus, unsern Herrn.\n℟. Amen.',
    fr: 'Daignez, Seigneur, répandre votre grâce dans nos âmes, afin qu’ayant connu, par le message de l’Ange, l’Incarnation de Jésus-Christ votre Fils, nous parvenions, par sa Passion et par sa Croix, à la gloire de sa Résurrection. Par le même Jésus-Christ notre Seigneur.\n℟. Amen.',
    es: 'Infunde, Señor, tu gracia en nuestras almas, para que, los que hemos conocido, por el anuncio del Ángel, la encarnación de tu Hijo Jesucristo, lleguemos por su pasión y su cruz a la gloria de la resurrección. Por el mismo Cristo nuestro Señor.\n℟. Amén.',
    pt: 'Infundi, Senhor, como vos pedimos, a vossa graça em nossas almas, para que nós, que pela anunciação do Anjo viemos ao conhecimento da encarnação de Jesus Cristo, vosso Filho, pela sua paixão e cruz sejamos conduzidos à glória da ressurreição. Pelo mesmo Cristo, Senhor nosso.\n℟. Amém.',
  } },
];

export const REGINA_CAELI = [
  { prayer: {
    la: 'Regina caeli, laetare, alleluia.\nQuia quem meruisti portare, alleluia.\nResurrexit, sicut dixit, alleluia.\nOra pro nobis Deum, alleluia.\n℣. Gaude et laetare, Virgo Maria, alleluia.\n℟. Quia surrexit Dominus vere, alleluia.',
    en: 'Queen of heaven, rejoice, alleluia.\nFor he whom thou didst merit to bear, alleluia,\nhath risen, as he said, alleluia.\nPray for us to God, alleluia.\n℣. Rejoice and be glad, O Virgin Mary, alleluia.\n℟. For the Lord hath risen indeed, alleluia.',
    de: 'Freu dich, du Himmelskönigin, Halleluja.\nDenn der, den du zu tragen würdig warst, Halleluja,\nist auferstanden, wie er gesagt hat, Halleluja.\nBitt Gott für uns, Halleluja.\n℣. Freu dich und frohlocke, Jungfrau Maria, Halleluja,\n℟. denn der Herr ist wahrhaft auferstanden, Halleluja.',
    fr: 'Reine du ciel, réjouissez-vous, alléluia.\nCar celui que vous avez mérité de porter, alléluia,\nest ressuscité comme il l’avait dit, alléluia.\nPriez Dieu pour nous, alléluia.\n℣. Soyez dans la joie et l’allégresse, Vierge Marie, alléluia.\n℟. Car le Seigneur est vraiment ressuscité, alléluia.',
    es: 'Reina del cielo, alégrate, aleluya.\nPorque el que mereciste llevar en tu seno, aleluya,\nha resucitado, según predijo, aleluya.\nRuega por nosotros a Dios, aleluya.\n℣. Gózate y alégrate, Virgen María, aleluya.\n℟. Porque verdaderamente ha resucitado el Señor, aleluya.',
    pt: 'Rainha do céu, alegrai-vos, aleluia.\nPorque aquele que merecestes trazer em vosso seio, aleluia,\nressuscitou como disse, aleluia.\nRogai a Deus por nós, aleluia.\n℣. Exultai e alegrai-vos, ó Virgem Maria, aleluia.\n℟. Porque o Senhor ressuscitou verdadeiramente, aleluia.',
  } },
  { prayer: { ...NAMES.oremus } },
  { prayer: {
    la: 'Deus, qui per resurrectionem Filii tui, Domini nostri Iesu Christi, mundum laetificare dignatus es: praesta, quaesumus; ut per eius Genetricem Virginem Mariam, perpetuae capiamus gaudia vitae. Per eundem Christum Dominum nostrum.\n℟. Amen.',
    en: 'O God, who by the resurrection of thy Son, our Lord Jesus Christ, didst vouchsafe to give joy to the world: grant, we beseech thee, that through his Mother, the Virgin Mary, we may obtain the joys of everlasting life. Through the same Christ our Lord.\n℟. Amen.',
    de: 'Gott, du hast durch die Auferstehung deines Sohnes, unseres Herrn Jesus Christus, die Welt mit Freude erfüllt. Lass uns durch seine jungfräuliche Mutter Maria zur unvergänglichen Freude des ewigen Lebens gelangen. Durch denselben Christus, unsern Herrn.\n℟. Amen.',
    fr: 'Ô Dieu, qui avez daigné réjouir le monde par la résurrection de votre Fils, notre Seigneur Jésus-Christ, faites, nous vous en prions, que par la Vierge Marie, sa Mère, nous parvenions aux joies de la vie éternelle. Par le même Jésus-Christ notre Seigneur.\n℟. Amen.',
    es: 'Oh Dios, que por la resurrección de tu Hijo, nuestro Señor Jesucristo, te has dignado alegrar al mundo, concédenos que por su Madre, la Virgen María, alcancemos los gozos de la vida eterna. Por el mismo Cristo nuestro Señor.\n℟. Amén.',
    pt: 'Ó Deus, que vos dignastes alegrar o mundo com a ressurreição do vosso Filho, Nosso Senhor Jesus Cristo, concedei-nos, vos pedimos, que, por sua Mãe, a Virgem Maria, alcancemos as alegrias da vida eterna. Pelo mesmo Cristo, Senhor nosso.\n℟. Amém.',
  } },
];

export const ANGELUS_RUBRIC = {
  la: 'Angelus dicitur mane, meridie et vesperi, cum campana pulsatur. A Paschate usque ad Sabbatum post Pentecosten dicitur, stando, Regina Caeli.',
  en: 'The Angelus is prayed in the morning, at noon and in the evening, when the bell rings. From Easter to the Saturday after Pentecost, the Regina Caeli is said instead, standing.',
  de: 'Der Angelus wird am Morgen, am Mittag und am Abend gebetet, wenn die Glocke läutet. Von Ostern bis zum Samstag nach Pfingsten betet man stattdessen stehend das Regina Caeli.',
  fr: 'L’Angelus se récite le matin, à midi et le soir, au son de la cloche. De Pâques au samedi après la Pentecôte, on dit à sa place, debout, le Regina Caeli.',
  es: 'El Angelus se reza por la mañana, al mediodía y por la tarde, al toque de la campana. Desde Pascua hasta el sábado después de Pentecostés, se reza en su lugar, de pie, el Regina Caeli.',
  pt: 'O Angelus reza-se de manhã, ao meio-dia e à tarde, ao toque do sino. Da Páscoa até o sábado depois de Pentecostes, reza-se em seu lugar, de pé, o Regina Caeli.',
};

export const EASTERTIDE_NOW = {
  la: 'Nunc est tempus paschale: dicitur Regina Caeli.',
  en: 'It is now Eastertide: the Regina Caeli is said.',
  de: 'Jetzt ist Osterzeit: man betet das Regina Caeli.',
  fr: 'C’est maintenant le temps pascal : on dit le Regina Caeli.',
  es: 'Ahora es tiempo pascual: se reza el Regina Caeli.',
  pt: 'Agora é tempo pascal: reza-se o Regina Caeli.',
};

export const ANGELUS_NAMES = { angelus: same('Angelus'), regina: same('Regina Caeli') };

/* ---------------- The Chaplet of Divine Mercy ---------------- */

export const MERCY = {
  eternal: {
    la: 'Pater aeterne, offero tibi Corpus et Sanguinem, Animam et Divinitatem dilectissimi Filii tui, Domini nostri Iesu Christi, in propitiationem pro peccatis nostris et totius mundi.',
    en: 'Eternal Father, I offer thee the Body and Blood, Soul and Divinity of thy dearly beloved Son, our Lord Jesus Christ, in atonement for our sins and for those of the whole world.',
    de: 'Ewiger Vater, ich opfere dir auf den Leib und das Blut, die Seele und die Gottheit deines über alles geliebten Sohnes, unseres Herrn Jesus Christus, zur Sühne für unsere Sünden und die der ganzen Welt.',
    fr: 'Père éternel, je vous offre le Corps et le Sang, l’Âme et la Divinité de votre Fils bien-aimé, notre Seigneur Jésus-Christ, en réparation de nos péchés et de ceux du monde entier.',
    es: 'Padre Eterno, te ofrezco el Cuerpo y la Sangre, el Alma y la Divinidad de tu amadísimo Hijo, nuestro Señor Jesucristo, como propiciación por nuestros pecados y los del mundo entero.',
    pt: 'Eterno Pai, eu vos ofereço o Corpo e o Sangue, a Alma e a Divindade de vosso diletíssimo Filho, Nosso Senhor Jesus Cristo, em expiação dos nossos pecados e dos do mundo inteiro.',
  },
  passion: {
    la: 'Pro dolorosa eius passione, miserere nobis et totius mundi.',
    en: 'For the sake of his sorrowful Passion, have mercy on us and on the whole world.',
    de: 'Durch sein schmerzhaftes Leiden hab Erbarmen mit uns und mit der ganzen Welt.',
    fr: 'Par sa douloureuse Passion, soyez miséricordieux pour nous et pour le monde entier.',
    es: 'Por su dolorosa Pasión, ten misericordia de nosotros y del mundo entero.',
    pt: 'Pela sua dolorosa Paixão, tende misericórdia de nós e do mundo inteiro.',
  },
  sanctus: {
    la: 'Sanctus Deus, Sanctus fortis, Sanctus immortalis, miserere nobis et totius mundi.',
    en: 'Holy God, Holy Mighty One, Holy Immortal One, have mercy on us and on the whole world.',
    de: 'Heiliger Gott, heiliger starker Gott, heiliger unsterblicher Gott, hab Erbarmen mit uns und mit der ganzen Welt.',
    fr: 'Dieu saint, Dieu fort, Dieu immortel, ayez pitié de nous et du monde entier.',
    es: 'Santo Dios, Santo Fuerte, Santo Inmortal, ten piedad de nosotros y del mundo entero.',
    pt: 'Deus Santo, Deus Forte, Deus Imortal, tende piedade de nós e do mundo inteiro.',
  },
};

/** Where in the Chaplet each step is (the language of the app; {n} and {k} filled in). */
export const MERCY_LABELS = {
  intro: {
    la: 'Corona Divinae Misericordiae in corona Rosarii dicitur, praesertim hora tertia post meridiem, hora mortis Domini. Tange «Sequens» (vel globulos) ut ab oratione ad orationem procedas.',
    en: 'The Chaplet of Divine Mercy is prayed on ordinary rosary beads, especially at three o’clock in the afternoon, the hour of Our Lord’s death. Tap “Next” (or the beads) to go from prayer to prayer.',
    de: 'Der Barmherzigkeitsrosenkranz wird an einem gewöhnlichen Rosenkranz gebetet, besonders um drei Uhr nachmittags, der Todesstunde unseres Herrn. Tippen Sie auf „Weiter“ (oder auf die Perlen), um von Gebet zu Gebet zu gehen.',
    fr: 'Le chapelet de la Divine Miséricorde se dit sur un chapelet ordinaire, surtout à trois heures de l’après-midi, l’heure de la mort de Notre-Seigneur. Touchez « Suivant » (ou les grains) pour passer d’une prière à l’autre.',
    es: 'La Coronilla de la Divina Misericordia se reza con un rosario ordinario, sobre todo a las tres de la tarde, la hora de la muerte de Nuestro Señor. Toque «Siguiente» (o las cuentas) para pasar de una oración a otra.',
    pt: 'O Terço da Divina Misericórdia reza-se num terço comum, sobretudo às três horas da tarde, a hora da morte de Nosso Senhor. Toque em «Seguinte» (ou nas contas) para passar de uma oração a outra.',
  },
  opening: { la: 'Initium', en: 'Opening', de: 'Eröffnung', fr: 'Ouverture', es: 'Inicio', pt: 'Abertura' },
  large: { la: 'Decas {n} · globulus maior', en: 'Decade {n} · the large bead', de: 'Gesätz {n} · die große Perle', fr: 'Dizaine {n} · le gros grain', es: 'Decena {n} · la cuenta grande', pt: 'Dezena {n} · a conta grande' },
  small: { la: 'Decas {n} · {k} ex 10', en: 'Decade {n} · {k} of 10', de: 'Gesätz {n} · {k} von 10', fr: 'Dizaine {n} · {k} sur 10', es: 'Decena {n} · {k} de 10', pt: 'Dezena {n} · {k} de 10' },
  closing: { la: 'Conclusio · {k} ex 3', en: 'Closing · {k} of 3', de: 'Abschluss · {k} von 3', fr: 'Conclusion · {k} sur 3', es: 'Conclusión · {k} de 3', pt: 'Conclusão · {k} de 3' },
  end: { la: 'Finis', en: 'The end', de: 'Ende', fr: 'Fin', es: 'Fin', pt: 'Fim' },
};

export const MERCY_NAMES = {
  eternal: { la: 'Pater aeterne', en: 'Eternal Father', de: 'Ewiger Vater', fr: 'Père éternel', es: 'Padre Eterno', pt: 'Eterno Pai' },
  passion: { la: 'Pro dolorosa eius passione', en: 'For the sake of his sorrowful Passion', de: 'Durch sein schmerzhaftes Leiden', fr: 'Par sa douloureuse Passion', es: 'Por su dolorosa Pasión', pt: 'Pela sua dolorosa Paixão' },
  sanctus: { la: 'Sanctus Deus', en: 'Holy God', de: 'Heiliger Gott', fr: 'Dieu saint', es: 'Santo Dios', pt: 'Deus Santo' },
};

/** The Chaplet, prayer by prayer: { name, text, label, bead } (bead: 'cross' | 'large' | 'small'). */
export function mercySteps() {
  const L = MERCY_LABELS;
  const steps = [
    { name: NAMES.signum, text: SIGNUM, label: [L.opening], bead: 'cross' },
    { name: NAMES.pater, text: PATER, label: [L.opening], bead: 'large' },
    { name: NAMES.ave, text: AVE, label: [L.opening], bead: 'small' },
    { name: NAMES.credo, text: CREDO, label: [L.opening], bead: 'cross' },
  ];
  for (let n = 1; n <= 5; n++) {
    steps.push({ name: MERCY_NAMES.eternal, text: MERCY.eternal, label: [L.large, { n }], bead: 'large', decade: n });
    for (let k = 1; k <= 10; k++) steps.push({ name: MERCY_NAMES.passion, text: MERCY.passion, label: [L.small, { n, k }], bead: 'small', decade: n });
  }
  for (let k = 1; k <= 3; k++) steps.push({ name: MERCY_NAMES.sanctus, text: MERCY.sanctus, label: [L.closing, { k }], bead: 'cross', closing: true });
  steps.push({ name: NAMES.signum, text: SIGNUM, label: [L.end], bead: 'cross', closing: true });
  return steps;
}

export const COMMON = { pater: [NAMES.pater, PATER], ave: [NAMES.ave, AVE], gloria: [NAMES.gloria, GLORIA], credo: [NAMES.credo, CREDO] };
