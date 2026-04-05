/** Turkish — P108 ürün sitesi + P134 lansman sayfaları (.tq, TORQA terimleri korunur) */
export const messagesTr: Record<string, string> = {
  "lang.switch": "Dil",
  "lang.en": "EN",
  "lang.tr": "TR",

  "theme.toggle": "Renk temasını değiştir",
  "theme.light": "Açık",
  "theme.dark": "Koyu",

  "nav.primary": "Ana gezinme",
  "nav.home": "Ana sayfa",
  "nav.product": "Ürün",
  "nav.why": "Neden TORQA",
  "nav.try": "Dene",
  "nav.quickstart": "2 dk başlangıç",
  "nav.proof": "Kanıt",
  "nav.docs": "Dokümantasyon",
  "nav.pricing": "Fiyatlandırma",
  "nav.contact": "İletişim",
  "nav.desktop": "Masaüstü",
  "nav.getApp": "Uygulamayı al",

  "hero.surfaceBadge": "Resmî ürün sitesi — torqa.dev",
  "hero.kicker": "Anlamsal öncelikli yürütme katmanı",
  "hero.h1": "Doğrulanmış spec. Daha az gürültü. Gerçek derlemeler.",
  "hero.tagline":
    "Ne istediğinizi düz dilde anlatın — TORQA bunu kontrollü bir spec ve somut çıktıya dönüştürür. Tek masaüstü uygulaması, tek kural motoru; CLI ve otomasyonla paylaşılır.",
  "hero.positionLead": "NL veya `.tq` → doğrulanmış IR → çıktılar.",
  "hero.positionRest":
    "Sıkıştırma öncelikli: Torqa yüzeyi aynı niyeti tipik bir doğal dil brifine göre daha az token ile taşır — inceleme, diff ve yeniden kullanım daha az bağlam harcar.",
  "hero.publicNote":
    "Tam üret → doğrula → derle → önizle döngüsü makinenizde TORQA Desktop’ta çalışır. Bu site ürünü anlatır; TORQA sunucu API’si varken isteğe bağlı tarayıcı önizlemesi sunabilir.",
  "hero.devNote":
    "Yerel arayüz geliştirme: siteyi Vite ile 3000 portunda çalıştırın; `/api` çağrıları için `torqa-console`u 8000 portunda açın.",
  "hero.cta.desktop": "TORQA Desktop’u alın",
  "hero.cta.quickstart": "2 dakikada başla",
  "hero.cta.try": "Canlı önizleme dene",
  "hero.cta.secondaryHint": "Derinlemesine: Ürün, Kanıt ve Dene — veya ana sayfada tam hikâyeyi kaydırın.",

  "story.token.h2": "Token hikâyesi",
  "story.token.p1":
    "Uzun istemler ve sohbet dökümlerini yeniden okumak, diff almak ve araçlara geri beslemek pahalıdır. TORQA yüzeyi anlamı koruyup token ayak izini küçültmek için tasarlandı — aynı niyet için insan ve modeller daha az bağlam harcar.",
  "story.token.p2":
    "Örnek sıkıştırmayı Dene sayfasında (canlı önizleme), amiral gemisi tarzı çubukları ise API erişilebilir olduğunda Kanıt sayfasında görebilirsiniz.",

  "story.validation.h2": "Gönderilmeden önce doğrulama",
  "story.validation.p1":
    "Spec’ler her yerde aynı kurallara göre kontrol edilir. Geçersiz paketler, üzerinde işlem yapılabilir tanılarla elenir — sessiz sapma veya derleme anı sürprizi değil.",
  "story.validation.p2":
    "Bu kapı, denemeler için boru hattını güvenilir kılar: önce yapı, sonra projeksiyonlar ve önizlemeler.",

  "audience.h2": "Kimler için",
  "audience.sub": "Yapıyı kaybetmeden hız isteyen ekipler.",
  "audience.c1.h": "Gerçek yazılım gönderen üreticiler",
  "audience.c1.p": "Tek doğrulanmış model üzerinden kod üretimi ve önizleme istersiniz — araçlara dağılmış tek seferlik istemler değil.",
  "audience.c2.h": "Yapay zekâ destekli tasarım kullanan ekipler",
  "audience.c2.p": "Doğal dil ile depolar arasında kalıcı bir spec katmanına ihtiyaç duyarsınız — incelenebilir, diff’lenebilir ve makine tarafından denetlenebilir.",
  "audience.c3.h": "Bakımcılar ve entegratörler",
  "audience.c3.p": "Masaüstü, CLI ve otomasyonun uyumlu olması önemlidir — tek motor, çift anlam yok.",

  "usecases.h2": "En iyi kullanım alanları",
  "usecases.sub": "TORQA’nın döngüde karşılığını bulduğu yerler.",
  "usecases.u1.h": "İstem-öncelikli yeni özellikler",
  "usecases.u1.p": "Briften başlayın, `.tq` ile sıkılaştırın, doğrulayın, ortamınız uygunsa çıktıları somutlaştırıp önizleme açın.",
  "usecases.u2.h": "Uygulamadan önce spec incelemesi",
  "usecases.u2.p": "Uzun metin duvarları yerine kompakt Torqa yüzeyi paylaşın — onaylamak, sorgulamak ve sürümlemek kolaylaşır.",
  "usecases.u3.h": "Tekrarlanabilir denemeler ve demolar",
  "usecases.u3.p": "Aynı amiral gemisi ölçümleri ve kapı kanıtları her seferinde — paydaşlar için inandırıcı sıkıştırma ve doğrulama hikâyesi.",

  "home.bench.teaser": "Amiral gemisi tarzı ölçüm özeti",
  "home.bench.linkProof": "Tam kanıt sayfası",
  "home.bench.linkTry": "Etkileşimli deneme sayfası",

  "quickstart.h2": "TORQA’yı 2 dakikada deneyin",
  "quickstart.sub":
    "Kısa yol — tam üret → doğrula → derleme bu tarayıcı sekmesinde değil, masaüstü uygulamasında çalışır.",
  "quickstart.li1":
    "Depodan kurun (`pip install -e .`) ve masaüstünü açın (`torqa-desktop` veya `cd desktop && npm run dev` — Electron penceresini kullanın).",
  "quickstart.li2": "Proje klasörünü seçin, düz dilde ne istediğinizi yazın ve Derle’ye basın.",
  "quickstart.li3":
    "İstenince önizlemeyi açın (Node.js gerekir); “istem ile spec karşılaştır” bölümünden tahmini token tasarrufunu görün.",
  "quickstart.cta": "Masaüstü uygulamasını al",
  "quickstart.aside": "Hesap gerekmez — kendi makinenizde, kendi API anahtarlarınızla çalışır.",

  "steps.h2": "Nasıl denersiniz",
  "steps.sub": "Tek yol. Bu sayfada uzun komut listesi yok.",
  "steps.s1.h": "Masaüstü uygulamasını açın",
  "steps.s1.p": "İstendiğinde proje klasörünüzü seçin.",
  "steps.s2.h": "Ne istediğinizi anlatın",
  "steps.s2.p": "Düz dil — bir ekip arkadaşına vereceğiniz brifing gibi.",
  "steps.s3.h": "Derleyin",
  "steps.s3.p": "Uygulama kontrollü spec üretir, dosyaları somutlaştırır; ortamınız hazırsa önizleme açabilir.",

  "why.h2": "Neden önemli",
  "why.sub": "Üç fikir — jargon duvarı yok.",
  "why.c1.h": "Daha az token, daha net niyet",
  "why.c1.p":
    "Kompakt spec’ler, sonsuz metin veya sohbet dökümünden daha az bağlam harcar — anlamdan ödün vermeden.",
  "why.c2.h": "Çıktıdan önce doğrulama",
  "why.c2.p": "Zayıf spec’ler erken ve net tanılarla elenir. Geçmeden kapıdan çıktı gönderilmez.",
  "why.c3.h": "Her yerde aynı ürün",
  "why.c3.p": "Masaüstü, CLI ve otomasyon aynı kural motorunu paylaşır — araçlar arası sapma yok.",

  "demo.region.aria": "İsteğe bağlı tarayıcı önizlemesi",
  "demo.title": "İsteğe bağlı: tarayıcıda önizleme",
  "demo.sub": "Örnek şablon ve token çubukları — API erişilebilir olduğunda çalışır.",
  "demo.apiHint":
    "Vite localhost:3000 iken başka bir terminalde torqa-console (veya python -m website.server) 8000 portunda çalışsın; /api istekleri oraya yönlendirilir.",
  "demo.label.prompt": "İstem metniniz",
  "demo.aria.prompt": "İsteğe bağlı önizleme için istem",
  "demo.defaultPrompt": "Kullanıcı adı, parola ve temel denetim alanlarıyla basit bir oturum açma akışı.",
  "demo.example": "Örneğe sıfırla",
  "demo.err.empty": "Önce bir istem girin.",
  "demo.err.request": "Önizleme isteği başarısız.",
  "demo.err.build": "Önizleme oluşturulamadı.",
  "demo.err.server":
    "Önizleme API’sine ulaşılamadı. localhost:3000 kullanıyorsanız 8000 portunda torqa-console çalıştırın veya siteyi TORQA sunucusundan servis edin.",
  "demo.btn.run": "Önizlemeyi çalıştır",
  "demo.btn.running": "Çalışıyor…",
  "demo.note.api": "Yalnızca yerel önizleme API’si",
  "demo.results.title": "Önizleme",
  "demo.results.placeholder": "Önizlemeyi çalıştırınca token karşılaştırması ve örnek yüzey görünür.",
  "demo.loading": "Önizleme oluşturuluyor…",
  "demo.profile": "Profil: {intent}",
  "demo.caption.bars": "İstem metniniz ve örnek Torqa yüzeyi (tahmini token)",
  "demo.bar.yourPrompt": "İstem metniniz",
  "demo.bar.templateTq": "Örnek yüzey",
  "demo.reduction": "Örnek yüzeyde istem metnine göre ~{pct}% daha az token (tahm.)",
  "demo.col.ran": "İstem metniniz",
  "demo.col.surface": "Örnek yüzey",
  "demo.hint.desktop": "Tam üret → doğrula → derle akışı için TORQA Desktop’u kullanın.",

  "bench.h2": "Ölçülür sıkıştırma",
  "bench.sub":
    "API hazır olduğunda amiral gemisi kıyas çubukları yüklenir — aynı fikir: Torqa yüzeyinde daha az token.",

  "bm.caption": "Doğal dil brifi ve Torqa yüzeyi (tahm.)",
  "bm.row.nl": "NL brif",
  "bm.row.tq": "Torqa",
  "bm.err.preview":
    "Kıyas API’sine ulaşılabildiğinde rakamlar görünür (ör. site :3000 iken torqa-console :8000).",
  "bm.err.connect": "Kıyas rakamları yüklenemedi.",
  "bm.incomplete": "Rakamlar eksik.",
  "bm.loading": "Yükleniyor…",

  "desktop.h2": "TORQA Desktop",
  "desktop.sub":
    "Ürün yolu istem-önceliklidir: anlat, derle, önizle — `.tq` dosyasını doğrudan düzenlemek için gelişmiş mod da vardır.",
  "desktop.body":
    "TORQA için zaten kullandığınız depodan kurun. Tam boru hattı için masaüstü uygulaması önerilir.",
  "desktop.install.h": "Kurulum (kısa)",
  "desktop.install.li1": "TORQA deposunu klonlayın; kökte Python 3.10+ ile `python -m pip install -e .` çalıştırın.",
  "desktop.install.li2":
    "Windows: dağıtıcıdan TORQA Desktop kurulum `.exe` dosyasını çalıştırın veya `desktop/` içinde `npm install` ardından `npm run pack:win` ile yükleyici üretin.",
  "desktop.install.li3": "TORQA Desktop’u açın (Başlat menüsü veya geliştirme için `torqa-desktop`). Klasör seçin, istem yazın, Derle’ye basın.",
  "desktop.install.li4": "API anahtarlarını uygulama içinde veya ortam değişkenleriyle ekleyin (`OPENAI_API_KEY` vb.). Ayrıntı: depo `desktop/README.md` ve `docs/P133_DESKTOP_DISTRIBUTION.md`.",
  "desktop.cta": "Dene sayfasını aç",
  "desktop.pointer": "Kısa yerel uygulama yönlendirme sayfası",

  "lp.product.h1": "Ürün",
  "lp.product.lead":
    "TORQA sıkıştırma öncelikli bir yürütme katmanıdır: doğal dil veya `.tq` kaynakları doğrulanmış ara temsile, ardından projeksiyonlara ve somut çıktılara dönüşür.",
  "lp.product.p1":
    "Birincil yazım yüzeyi masaüstü uygulamasıdır — klasör seçici, istem veya gelişmiş `.tq` düzenleme, doğrula, derle, kıyas ve ortamınız uygunsa önizleme.",
  "lp.product.p2":
    "Okuduğunuz site yalnızca pazarlama ve kanıttır. IDE değildir ve masaüstü döngüsünün yerini almaz.",
  "lp.product.linkTry": "Dene sayfasına git",
  "lp.product.linkProof": "Kanıtı gör",

  "lp.proof.h1": "Kanıt",
  "lp.proof.lead":
    "İnançlılık ölçülebilir sıkıştırma ve sert bir doğrulama kapısından gelir. Aşağıdaki bloklar, sunucu API’si varken amiral gemisi demoyla aynı herkese açık kıyas JSON’unu kullanır.",
  "lp.proof.note": "Yöntem ve örnekler için depo dokümanlarına bakın: `docs/BENCHMARK_FLAGSHIP.md`, `docs/VALIDATION_GATE.md`.",

  "p136.site.title": "Dürüst karşılaştırma (GPT · Claude · Gemini ve TORQA)",
  "p136.site.badgeRef": "Referans veri",
  "p136.site.lead":
    "Yalnızca çevrimdışı kıyaslar — depo ile aynı tahminci, örnek USD kademeleri. Canlı yeniden deneme, başarı ve kalite puanı bu dosyada yok; gerçek çalıştırmadan sonra TORQA Desktop’ta görünür.",
  "p136.site.loading": "Karşılaştırma özeti yükleniyor…",
  "p136.site.flagship": "Amiral gemisi web kabuğu",
  "p136.site.tokenProof": "İş akışı ve otomasyon token kanıtı",
  "p136.site.ratio": "NL ÷ TORQA",
  "p136.site.taskTok": "Görev",
  "p136.site.tqTok": "TORQA yüzeyi",
  "p136.site.avgCompress": "Ort. istem ÷ TORQA",
  "p136.site.scenarios": "Geçen senaryo",
  "p136.site.family.websites": "Web siteleri",
  "p136.site.family.apps": "Uygulamalar",
  "p136.site.family.workflows": "İş akışları",
  "p136.site.family.automations": "Otomasyonlar",
  "p136.site.live": "Canlı API: TORQA Desktop çalışma özeti / ayrıntılar — burada toplanmaz.",
  "p136.site.doc": "Tam anlatım: `docs/COMPARISON_REPORT.md` · yenileme: `torqa-comparison-report`",

  "lp.try.h1": "Dene",
  "lp.try.lead": "Masaüstü uygulamasıyla başlayın; API erişilebilir olduğunda aşağıda isteğe bağlı tarayıcı önizlemesini çalıştırın.",

  "lp.docs.h1": "Dokümantasyon",
  "lp.docs.lead":
    "Otoriter kılavuzlar TORQA deposunda gelir. `pip install -e .` sonrası bu yolları klonunuzdan açın — çalıştırdığınız kodla birlikte sürümlenirler.",
  "lp.docs.try": "`docs/TRY_TORQA.md` — resmî yüzeyler ve öncelikli deneme yolu",
  "lp.docs.quick": "`docs/QUICKSTART.md` — kurulum ve ilk derleme",
  "lp.docs.limits": "`docs/KNOWN_LIMITS.md` — kapsam ve deneme sınırları",
  "lp.docs.desktop": "`docs/P133_DESKTOP_DISTRIBUTION.md` — Windows masaüstü paketleme",
  "lp.docs.map": "`docs/DOC_MAP.md` — tam dokümantasyon dizini",
  "lp.docs.comparison": "`docs/COMPARISON_REPORT.md` — P136 lansman karşılaştırması (referans vs canlı, makine JSON)",
  "lp.docs.console":
    "Bu siteyi entegre sunucudan servis etmek için `torqa-console` çalıştırın ve yazdığı kök URL’yi açın (derlenmiş paket `/static/site/` altında). HTTP API gezgini: `/api/openapi/docs`.",

  "lp.pricing.h1": "Fiyatlandırma",
  "lp.pricing.lead": "TORQA çekirdeği açık kaynaktır. Ticari koşullar, barındırılan hizmetler ve kurumsal paketler bu sayfada henüz listelenmemektedir.",
  "lp.pricing.b1": "Erken denemeler çoğunlukla herkese açık depo ve ekibinizin sağladığı masaüstü yükleyicisiyle başlar.",
  "lp.pricing.b2": "Paketleme, değerlendirme anlaşmaları veya öncelikli destek için aşağıdaki iletişim yolunu kullanın.",
  "lp.pricing.cta": "İletişim",

  "lp.contact.h1": "İletişim ve geri bildirim",
  "lp.contact.lead": "Bu sayfayı sade tuttuk; mesajların nereye gitmesi gerektiği her zaman net olsun.",
  "lp.contact.p1":
    "TORQA’yı bir deneme veya iş ortağı aracılığıyla aldıysanız, ürün geri bildirimi ve destek için size verilen kanalı (e-posta, sohbet veya sorun izleyici) kullanın.",
  "lp.contact.p2":
    "Herkese açık kaynak ağacı için teknik tartışma o deponun yanında (sorunlar veya bakımcı e-postası) yer alır; bu pazarlama sunucusunda değil.",
  "lp.contact.emailIntro": "Dağıtımınız derleme sırasında herkese açık bir iletişim adresi ayarlarsa burada görünür:",
  "lp.contact.emailBtn": "E-posta gönder",

  "footer.brand": "TORQA",
  "footer.copy": "Açık kaynak. Yerel önizlemeler için güvenilir ortamlar kullanın.",
  "footer.nav": "Keşfet",
};
