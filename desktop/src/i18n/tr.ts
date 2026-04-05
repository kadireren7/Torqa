/** Turkish UI strings — natural product Turkish, product terms (.tq, TORQA, GPT) kept where standard. */
export const messagesTr: Record<string, string> = {
  "lang.switch": "Dil",
  "lang.en": "EN",
  "lang.tr": "TR",

  "shell.missing.title": "Bu görünümde klasör ve .tq seçimi çalışmaz",
  "shell.missing.p1":
    "`torqaShell` yüklenmedi — büyük olasılıkla bir tarayıcıdasınız (ör. `http://localhost:5173`). Dosya seçimi yalnızca Electron masaüstü penceresinde çalışır; tarayıcılar güvenlik nedeniyle köprüyü engeller.",
  "shell.missing.h2": "Şunu yapın",
  "shell.missing.li1":
    "Bu tarayıcı sekmesini kapatın (adres çubuğunda `http://` görüyorsanız sorun budur).",
  "shell.missing.li2.before": "PowerShell / Terminal:",
  "shell.missing.li3": "Depo kökünden: `pip install -e .` ardından `torqa-desktop`",
  "shell.missing.li4":
    "`npm run dev` kullanıyorsanız: Electron’un açtığı masaüstü penceresini kullanın (gömülü önizleme oradadır).",
  "shell.missing.foot":
    "Doğru pencerede adres çubuğu yoktur; üstte uygulama menüsü ve TORQA görünür.",

  "shell.bridge.error":
    "TORQA kabuğu kullanılamıyor — Electron masaüstü uygulamasını çalıştırın (torqa-desktop veya cd desktop && npm run start).",

  "brand": "TORQA",
  "theme.toggle": "Renk temasını değiştir",

  "p131.home.lead":
    "TORQA, kısa bir açıklamayı seçtiğiniz klasörde kontrol edilmiş bir spec ve gerçek proje dosyalarına dönüştürür.",
  "p131.home.promptLabel": "Ne oluşturmak istiyorsunuz?",
  "p131.workspace.lead":
    "Proje, başlık çubuğundaki klasöre kaydedilir. Ne istediğinizi yazın, ardından Derle’ye basın.",
  "p131.dismiss": "Kapat",
  "p131.dismiss.aria": "İpucunu kapat",
  "p131.hint.welcomeHome":
    "Önce bir klasör seçin (TORQA dosyaları oraya yazar). Kısa bir açıklama ekleyip Derle’ye basın.",
  "p131.hint.readyBuild": "İstem hazırsa Derle ile spec’i ve projeyi üretin.",
  "p131.hint.tryPreview":
    "Node.js yüklüyse Önizlemeyi başlat, Bölünmüş görünüm veya Tarayıcıda aç ile siteyi görün.",
  "p131.hint.tryCompare":
    "Aşağıdaki “İsteminizi ve kayıtlı spec’i karşılaştırın” bölümünü açarak tahmini jeton tasarrufunu görün.",

  "home.prompt.placeholder": "Ne inşa etmek istediğinizi yazın…",
  "home.prompt.aria": "İstem metni",
  "home.chooseFolder": "Klasör seç",
  "home.chooseFolder.title": "Proje klasörünü seçin",
  "home.build": "Derle",
  "home.building": "Derleniyor…",
  "home.openProject": "Mevcut projeyi aç",
  "home.editor": "Düzenleyici",

  "title.openFolder": "Proje klasörünü değiştir",
  "title.openTq": ".tq dosyası aç (Ctrl+O)",
  "title.openTqEllipsis": ".tq aç…",
  "title.save": "Kaydet (Ctrl/Cmd+S)",
  "title.validateCore": "Geçerli dosyayı çekirdek ile doğrula",
  "title.genTqOnly": "Yalnızca .tq üret (tam derleme yok)",
  "title.openExisting": "Proje klasörünü değiştir",
  "title.editor": "Dosyaları düzenle, doğrula ve diske derle",
  "title.toggleRight": "Sağ paneli aç/kapat",

  "status.validating": "Doğrulanıyor…",
  "status.building": "Derleniyor…",
  "status.benchmark": "Kıyaslama…",
  "status.generating": "Üretiliyor…",
  "status.pipeline": "İşlem hattı…",
  "status.pass": "TAMAM",
  "status.fail": "HATA",
  "status.ready": "Hazır",

  "btn.validate": "Doğrula",
  "btn.build": "Derle",
  "btn.benchmark": "Kıyasla",
  "btn.save": "Kaydet",
  "btn.genTq": "Sadece .tq",
  "btn.folder": "Klasör…",

  "p117.group.aria": "Mevcut özeti geliştir",
  "p117.improve": "Uygulamayı iyileştir",
  "p117.addFeature": "Özellik ekle",
  "p117.improve.title":
    "Açık .tq dosyasını isteğine göre rafine eder; yeni numaralı sürüm kaydeder (v2, v3, …).",
  "p117.addFeature.title": "Açık .tq dosyasına isteğinden yeni yetenek ekler; yeni sürüm kaydeder.",
  "p117.needTq": "Önce kenar çubuğundan bir .tq dosyası açın (evolve diskteki dosyayı kullanır).",
  "p117.savedEdition": "Sürüm manifesti v{edition} — {path}",

  "pipeline.pill.generating": "Üretim",
  "pipeline.pill.validating": "Doğrulama",
  "pipeline.pill.building": "Derleme",
  "pipeline.pill.launching": "Önizleme",

  "pipeline.busy.generate": "Açıklamanız yapılandırılmış plana dönüştürülüyor…",
  "pipeline.busy.validate": "Planın tutarlılığı kontrol ediliyor…",
  "pipeline.busy.build": "Proje dosyaları yazılıyor…",
  "pipeline.busy.preview": "Önizleme başlatılıyor…",
  "pipeline.busy.done": "Tamamlanıyor…",
  "pipeline.busy.working": "Çalışılıyor…",

  "failure.lead.gpt":
    "Yapay zekâ adımı tamamlanmadı. API anahtarınızı ve bağlantınızı kontrol edip yeniden deneyin.",
  "failure.lead.torqa":
    "Bir taslak oluştu ancak kalite kontrollerimizden geçmedi. Daha sade bir anlatım deneyin.",
  "failure.lead.setup":
    "Başlamadan önce bir şeyler eksikti — örneğin klasör veya boş istem.",
  "failure.lead.unknown": "Bir şeyler ters gitti. Aşağıdaki liste sonraki adımı gösterebilir.",

  "failure.axis.title": "Ne başarısız oldu — GPT ve TORQA",
  "failure.axis.aria": "GPT ve TORQA bağlamında hata",
  "failure.axis.gpt.head": "GPT / OpenAI (deterministik değil)",
  "failure.axis.gpt.lede":
    "Tipik sorunlar: OPENAI_API_KEY eksikliği, HTTP 401/429/5xx, model JSON biçimi hataları veya doğrulayıcı reddederken maksimum onarım denemeleri.",
  "failure.axis.gpt.badge": "Çalışma burada durdu — LLM yolu kabul edilen bir adım üretmedi.",
  "failure.axis.torqa.head": "TORQA (deterministik)",
  "failure.axis.torqa.lede":
    "Her seferinde aynı kontroller: spec biçimi, iç tutarlılık ve dosya üretimi — modelin yaratıcılığından bağımsız.",
  "failure.axis.torqa.badge":
    "Çalışma burada durdu — GPT metin üretmiş olabilir ancak TORQA spec’i geçitlerinden geçiremedi.",
  "failure.axis.setup.after":
    " — GPT veya TORQA çalışmadan önce çalışma alanı veya istem geçersizdi. Klasör / metni düzeltip yeniden deneyin.",
  "failure.axis.setup.bold": "Kurulum",
  "failure.axis.unknownNote":
    "Ayrıntılar aşağıda. Günlükte OpenAI veya {pxai} geçiyorsa {gpt} hatası; parse, TQ hataları veya materialize geçiyorsa {torqa} hatası sayın.",
  "failure.axis.noteBold.gpt": "GPT",
  "failure.axis.noteBold.torqa": "TORQA",

  "pipeline.summary.generating": "Üretim",
  "pipeline.summary.validating": "Doğrulama",
  "pipeline.summary.building": "Derleme",
  "pipeline.summary.launching": "Önizleme",

  "human.none.result": "Uygulamadan net bir sonuç okuyamadık.",
  "human.dash": "—",
  "human.gen.fail":
    "İsteminizden uygulama planı çıkaramadık. Çoğunlukla API anahtarı veya ağ sorunudur.",
  "human.gen.ok": "Açıklamanızdan yapılandırılmış bir plan oluşturuldu.",
  "human.gen.wait": "—",
  "human.val.skip.draft": "Taslak adımı bitmediği için atlandı.",
  "human.val.fail.parse":
    "Taslak kontrollerimizden geçmedi. Daha sade ifade veya daha az özellik deneyin.",
  "human.val.ok": "Plan tutarlı görünüyor.",
  "human.val.wait": "—",
  "human.build.skip": "Önceki adımlar başarılı olana kadar atlandı.",
  "human.build.fail.write": "Tüm proje dosyalarını yazamadık. Öneriler için Ayrıntılar’ı açın.",
  "human.build.ok": "Proje dosyaları klasörünüze yazıldı.",
  "human.build.fail.generic": "Derleme adımı başarıyla tamamlanmadı.",
  "human.launch.skip": "—",
  "human.launch.ok.preview": "Önizleme hazır — yukarıdaki düğmelerle açın.",
  "human.launch.ok.node":
    "Dosyalar hazır; otomatik önizleme başlamadı (etkinleştirmek için Node.js kurun).",
  "human.launch.skip.preview": "Bu çalışma için otomatik önizleme başlatılmadı.",

  "stack.title": "İsteminiz ve kayıtlı spec",
  "stack.aria": "İstem metni ile kayıtlı spec karşılaştırması",
  "stack.lede":
    "{left}: düz dilde ne istediğiniz. {right}: aynı çalışmadan, projenin üretilmesine izin verilen kontrol edilmiş spec dosyası.",
  "stack.leftBold": "Sol",
  "stack.rightBold": "Sağ",
  "stack.col.plain": "Düz dilde istem",
  "stack.col.spec": "Kayıtlı spec",
  "stack.tokensEst": "~jeton (tahmini)",
  "stack.vs": "karşı",
  "stack.bar.prompt": "İstem",
  "stack.bar.spec": "Spec",
  "stack.bar.reduction": "Azalma",
  "stack.noTokens": "Jeton tahmini yok — aşağıdaki metni karşılaştırın.",
  "stack.reductionLine": "Yalnızca isteme göre kabaca: kayıtlı spec yaklaşık {pct}% daha küçük.",
  "stack.stats":
    "Uzunluk (karakter): istem {nl} · spec {tq}{ratio}",
  "stack.stats.ratio": " (istem uzunluğunun %{pct}’i)",
  "stack.out.prompt": "İsteminiz",
  "stack.out.spec": "Kayıtlı spec",

  "tokenPanel.title": "Boyut karşılaştırması (tahmini)",
  "tokenPanel.aria": "Tahmini jeton: düz istem {pt}, kayıtlı plan {tq}, azalma {r}",
  "tokenPanel.aria.ir": "Tahmini jeton: IR JSON {pt}, TORQA yüzeyi {tq}, azalma {r}",
  "tokenPanel.aria.notReported": "raporlanmadı",
  "tokenPanel.label.plain": "Aynı fikir düz metinde",
  "tokenPanel.label.irJson": "Kanonik IR JSON (tahm.)",
  "tokenPanel.label.spec": "Kayıtlı spec",
  "tokenPanel.label.smaller": "Düz metinden daha küçük",
  "tokenPanel.emdash": "—",

  "tokenSavings.aria": "Jeton verimliliği ve tahmini tasarruf",
  "tokenSavings.title": "Jeton verimliliği",
  "tokenSavings.badge.intent": "Bu çalışma",
  "tokenSavings.badge.build": "Derleme (IR / yüzey)",
  "tokenSavings.badge.estimate": "Tahmin aracı (API kullanımı değil)",
  "tokenSavings.stat.torqa": "TORQA yüzeyi",
  "tokenSavings.stat.reduction": "Karşılaştırmaya göre azalma",
  "tokenSavings.stat.ratio": "Sıkıştırma oranı",
  "tokenSavings.bar.torqa": "TORQA yüzeyi",
  "tokenSavings.summary.nl": "TORQA bu niyet için yaklaşık {pct}% daha az jeton kullandı (tahmini).",
  "tokenSavings.summary.nlNeutral": "Karşılaştırma ~{pt} jeton, TORQA yüzeyi ~{tq} (tahmini).",
  "tokenSavings.summary.ir":
    "Bu TORQA yüzeyi, bu derleme için kanonik IR JSON’a göre yaklaşık {pct}% daha az tahmini jeton kullanıyor.",
  "tokenSavings.summary.irNeutral":
    "Aynı niyeti IR JSON olarak serileştirmeye kıyasla yüzey, daha kompakt yürütme katmanıdır (tahm.).",
  "tokenSavings.cost.title": "Tahmini girdi maliyeti azaltması (örnek)",
  "tokenSavings.cost.lead":
    "Her iki taraf için örnek girdi tarifesi: 1M jeton başına ${rate} — canlı fiyat veya fatura değildir.",
  "tokenSavings.cost.line":
    "Karşılaştırma ekseninde ~${hi} ve ~${lo}; yalnızca TORQA yüzeyini taşımak yaklaşık ${save} daha ucuz (örnek).",
  "tokenSavings.proof.line":
    "Repoya işlenmiş iş akışı kanıtı ({suite}): {n} geçen senaryoda ortalama doğal dil→TORQA yaklaşık {pct}% azalma (utf8÷4 tahmini).",
  "tokenSavings.proof.missing":
    "Kamu özetini yüklemek için bu uygulamada depo kökünü açın (reports/token_proof.json).",
  "tokenSavings.estimator": "Belirleyici tahmin aracı: {id}",

  "api.title": "Yapay zekâ kullanımı (bu çalışma)",
  "api.liveBadge": "Canlı API",
  "api.honestNote":
    "Girdi/tamamlama sayıları bu çalışma için sağlayıcı yanıtından gelir. Tahmini USD yalnızca bu sürümde OpenAI için doldurulur; diğer sağlayıcılar burada tarifesiz kullanım gösterir.",
  "api.aria": "Bu çalışma için yapay zekâ kullanımı",
  "api.httpCalls": "HTTP çağrıları",
  "api.retries": "Onarım yeniden denemeleri",
  "api.retries.hint": " (ilk yanıttan sonraki ek turlar)",
  "api.latency": "Toplam gecikme",
  "api.billable": "Ücretlendirilebilir jetonlar (API)",
  "api.billable.line": "girdi {inT} · çıktı {outT} · toplam {totT}",
  "api.cost": "Tahm. maliyet",
  "api.cost.na": "— (bu model için tarife yok)",
  "api.cost.usd": "~{usd} USD",
  "api.model": "Model",
  "api.provider": "Sağlayıcı",

  "llm.aria": "Dil modeli ve API anahtarları",
  "llm.sectionTitle": "Yapay zekâ modeli",
  "llm.vendorStrip": "OpenAI · Anthropic · Google",
  "llm.flowHint":
    "Sağlayıcıyı, isteğe bağlı model kimliklerini ve bir üretim ön ayarını seçin. Ayrıştırma, tanılar ve kalite eşiği tüm sağlayıcılarda aynı; P129 ön ayara göre varsayılanları ayarlar.",
  "llm.label": "Sağlayıcı",
  "llm.gpt": "GPT (OpenAI)",
  "llm.claude": "Claude (Anthropic)",
  "llm.gemini": "Gemini (Google)",
  "llm.presenceTitle": "Anahtar yapılandırıldı: OpenAI · Anthropic · Google (dolu nokta = evet)",
  "llm.key.openai": "OpenAI",
  "llm.key.anthropic": "Anthropic",
  "llm.key.google": "Google AI",
  "llm.showKeys": "API anahtarları…",
  "llm.hideKeys": "Anahtarları gizle",
  "llm.keysHint":
    "İsteğe bağlı. Mümkünse anahtarlar işletim sistemi güvenli depolamasıyla şifrelenir. Ortam değişkeni olarak OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY veya GEMINI_API_KEY de kullanılabilir.",
  "llm.keyPlaceholder": "Anahtarı yapıştırın (yalnızca Kaydet’e basınca saklanır)",
  "llm.clearSlot": "Saklanan anahtarı sil",
  "llm.saveKeys": "Boş olmayanları kaydet",
  "llm.saveUnavailable": "Bu görünümde anahtar saklama kullanılamıyor.",
  "llm.saveError": "Kaydedilemedi: {error}",
  "llm.keysSaved": "API anahtarları kaydedildi (yalnızca dolu alanlar; güvenli depolama varsa şifrelenir).",
  "llm.providerSaveError": "Model tercihi kaydedilemedi: {error}",
  "llm.autoFixNoTq":
    "Otomatik düzeltme yeni bir .tq döndürmedi (Çıktı’ya bakın; seçtiğiniz model için API anahtarı ekleyin veya OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY ayarlayın).",
  "llm.appStarted":
    "Başladı: torqa app ({slot}) — {model} — üret → doğrula → üret (dosya) — profil: {profile}",
  "llm.generateTqStarted": ".tq üret — {model} — profil: {profile}",
  "llm.fallbackUsed": "Birincil model başarısız; bu çalışma OpenAI yedeklemesiyle tamamlandı.",
  "llm.sameProviderFallbackUsed": "Birincil model başarısız; aynı sağlayıcıdaki yedek model ile tamamlandı.",
  "llm.genMode": "En iyi mod",
  "llm.genMode.balanced": "Dengeli (varsayılan)",
  "llm.genMode.cheapest": "En ucuz",
  "llm.genMode.fastest": "En hızlı",
  "llm.genMode.highest_quality": "En yüksek kalite",
  "llm.genMode.most_reliable": "En güvenilir",
  "llm.modelId": "Model kimliği",
  "llm.modelId.placeholder": "Boş = sağlayıcı varsayılanı",
  "llm.fallbackModelId": "Yedek model (aynı sağlayıcı)",
  "llm.fallbackModelId.placeholder": "İsteğe bağlı — birincil tükendikten sonra",

  "p116.progressLine": "Üretim adımı {phase}/{total} ({id}): {status}",
  "p116.rotate.0": "Çok adımlı üretim: temel .tq taslağı…",
  "p116.rotate.1": "Çok adımlı üretim: yapı genişletiliyor…",
  "p116.rotate.2": "Çok adımlı üretim: düzen ve mantık cilalanıyor…",
  "p116.trace.title": "Üretim geçişleri",
  "p116.trace.aria": "Çok aşamalı .tq üretim adımları",
  "p116.traceSummary": "Çok adımlı üretim tamam: {summary}",

  "trial.fail.title": "Bir şeyler ters gitti",
  "trial.techDetails": "Teknik ayrıntılar",
  "trial.engineDetails": "Motorun ayrıntıları",
  "trial.whatToTry": "Deneyebilecekleriniz",
  "trial.tryAgain": "Yeniden dene",
  "trial.retrying": "Yeniden deneniyor…",
  "trial.openSummary": "Çalışma özetini aç",
  "trial.log.pipelineFail":
    "Başarısız — ne olduğu ve önerilen düzeltmeler için aşağıdaki Çalışma özetini açın. Ham metin için Çıktı; zaman damgalı günlük için Etkinlik.",
  "trial.apiBeforeFail": "Hata öncesi yapay zekâ kullanımı",

  "trial.success.title": "Hazır",
  "trial.success.metricsIntro": "Bu çalışma — kullanım ve TORQA verimliliği",
  "trial.compare.summary": "İsteminizi ve kayıtlı spec’i karşılaştırın",
  "trial.splitView": "Bölünmüş görünüm",
  "trial.openBrowser": "Tarayıcıda aç",
  "trial.retryPreview": "Önizlemeyi yeniden dene",
  "trial.startPreview": "Önizlemeyi başlat",
  "trial.previewFoot":
    "Önizleme otomatik başlamadı. Node.js kurun, Önizlemeyi başlat’ı kullanın veya {webapp} içinde {npmI} ve {npmDev} çalıştırın.",

  "p130.proof.aria": "Bu üretim çalışması için kalite ve güvenilirlik",
  "p130.proof.title": "Kalite ve güvenilirlik (bu çalışma)",
  "p130.proof.quality": "Kalite skoru (sezgisel)",
  "p130.proof.partialValidity": "Kısmi deneme geçerlilik oranı",
  "p130.proof.mode": "Üretim modu",
  "p130.proof.models": "Birincil / yedek model",
  "p130.proof.reliability": "Sonuç",
  "p130.proof.firstPass": "İlk denemede başarı",
  "p130.proof.repaired": "Önceki denemelerden sonra toparlandı",
  "p130.proof.attemptsLine": "Bu çalışmada {n} LLM denemesi",
  "p130.trialLog.quality": "Kalite skoru (sezgisel): {score}/100",
  "p130.trialLog.partialValidity": "Kısmi deneme geçerlilik oranı: {rate}",
  "p130.trialLog.repaired": "Güvenilirlik: onarım / yeniden deneme sonrası başarı",
  "p130.trialLog.firstPass": "Güvenilirlik: ilk denemede başarı",
  "p130.trialLog.profileMode": "Üretim modu: {mode}",

  "fail.reliability.attempts": "Bu sonuçtan önce {n} LLM denemesi — tam iz için Çıktı veya Etkinlik’e bakın.",
  "fail.reliability.kinds": "Görülen hata türleri (sırayla): {kinds}",

  "editor.noFile": "Açık dosya yok",
  "editor.pickFile": " — listeden bir dosya seçin",
  "editor.modified": " · değiştirildi",
  "editor.toolbar.preview": "Önizleme",
  "editor.splitPreview": "Bölünmüş önizleme",
  "editor.hidePreview": "Önizlemeyi gizle",
  "editor.reload": "Yenile",
  "editor.browser": "Tarayıcı",
  "editor.coreConnected": "Çekirdek bağlı",
  "title.previewHide": "Gömülü önizlemeyi gizle (tam genişlik düzenleyici)",
  "title.previewSplit": "Kod + önizleme bölünmüş görünümü",
  "title.reloadPreview": "Iframe’i yenile",
  "title.browserPreview": "Önizleme URL’sini sistem tarayıcısında aç",

  "insight.bench.emptyPara":
    "Disk üzerinde flagship tarzı sıkıştırma için Kıyasla çalıştırın. Beş senaryolu, doğrulamalı kamu jeton kanıtı için docs/TOKEN_PROOF.md ve torqa-token-proof dosyalarına bakın. Panel boş kalırsa stderr için Çıktı sekmesini açın.",

  "diag.region.buildFailure": "Derleme hatası ayrıntıları",
  "editor.preview.aria": "Önizleme",
  "editor.preview.titleHide": "Gömülü önizlemeyi gizle (tam genişlik düzenleyici)",
  "editor.preview.titleShow": "Kod + önizleme bölünmüş görünüm",
  "editor.preview.reloadTitle": "iframe’i yenile",
  "editor.preview.browserTitle": "Önizleme URL’sini sistem tarayıcısında aç",

  "preview.title": "Canlı önizleme",
  "preview.iframeTitle": "Üretilen web uygulaması önizlemesi",

  "insight.tab.spec": "Spec ayrıntısı",
  "insight.tab.bench": "Kıyaslama",
  "insight.tab.models": "Modeller",
  "insight.tab.feedback": "Geri bildirim",
  "insight.bench.tokenNote":
    "Jeton tahminleri (flagship / P31 klasörü). Çok senaryolu kanıt (depo kökü): {doc} · {cmd} · {rep}. Tam komut için Çıktı’ya bakın.",
  "insight.bench.empty":
    "Disk üzerinde flagship tarzı sıkıştırma için {benchmark} çalıştırın. Beş senaryolu, doğrulamalı kamu kanıtı için {doc} ve {cmd} dosyalarına bakın. Panel boş kalırsa stderr için Çıktı sekmesini açın.",

  "modelCompare.badge.reference": "Referans tahmini",
  "modelCompare.badge.live": "Canlı API sonucu",
  "modelCompare.lead":
    "Yalnızca çevrimdışı referans: TORQA’yı depodaki jeton kanıtı senaryolarının ortalamalarıyla GPT-, Claude- ve Gemini tarzı istem/kod zarflarıyla karşılaştırın. API anahtarı gerekmez. Bu tablo az önce yaptığınız canlı üretim değildir.",
  "modelCompare.p123.referenceOnly":
    "Yukarıdaki tüm veriler reports/token_proof.json dosyasından hesaplanır — az önce yaptığınız bir model çağrısından gelmez.",
  "modelCompare.empty":
    "Depo kökünü açın (reports/token_proof.json okunabilsin) veya torqa-token-proof ile raporu yenileyin. Bu panel çevrimdışı kalır.",
  "modelCompare.table.aria": "İş akışı karşılaştırması: TORQA ve LLM tarzı yollar",
  "modelCompare.th.metric": "Ölçüt",
  "modelCompare.th.torqa": "TORQA",
  "modelCompare.th.gpt": "GPT tarzı",
  "modelCompare.th.claude": "Claude tarzı",
  "modelCompare.th.gemini": "Gemini tarzı",
  "modelCompare.row.input": "Girdi jetonları (tahm.)",
  "modelCompare.row.output": "Çıktı jetonları (tahm.)",
  "modelCompare.row.totalCost": "Toplam tahm. maliyet (USD)",
  "modelCompare.row.retries": "Yeniden deneme",
  "modelCompare.row.inRedTorqa": "TORQA’ya göre girdi azalması",
  "modelCompare.row.costRedTorqa": "NL yoluna göre maliyet azalması",
  "modelCompare.retries.na": "— (çevrimdışı ölçülmedi)",
  "modelCompare.cost.nl": "NL yolu",
  "modelCompare.cost.torqa": "TORQA yolu",
  "modelCompare.short.gpt": "GPT ref.",
  "modelCompare.short.claude": "Claude ref.",
  "modelCompare.short.gemini": "Gemini ref.",
  "modelCompare.note.suite": "Veri: reports/token_proof.json · paket {id} · {n} geçen senaryo ortalaması.",
  "modelCompare.note.estimator":
    "Jetonlar rapordaki belirleyici tahmin aracını kullanır ({id}) — göreli boyut içindir, satıcı faturaları için değil.",
  "modelCompare.note.tokens":
    "NL tarzı sütunlar senaryo başına TASK.md görev metninin boyutunu kullanır. TORQA doğrulanmış .tq yüzey boyutunu kullanır.",
  "modelCompare.note.llmOut":
    "LLM tarzı çıktı boyutu, sabit BASELINE_CODE.txt tahminidir — canlı model çıktısı değildir.",
  "modelCompare.note.torqaOut":
    "TORQA çıktı sütunu aynı rapordaki IR paket tahminini kullanır (yüzeye göre genişletilmiş biçim).",
  "modelCompare.note.pricing":
    "Sütun başına $, o satıcı tarzı için örnek $/MTok referansı kullanır (2026 başı örnek liste kademeleri). Güncel tarifeleri OpenAI, Anthropic ve Google’dan doğrulayın.",
  "modelCompare.note.costRow":
    "Satıcı hücreleri, o sütunun referans fiyatlarıyla NL ve TORQA yollarını üst üste gösterir; maliyet % karıştırılmaz.",
  "modelCompare.advanced.summary": "Gelişmiş: isteğe bağlı yerel anahtarlar (eski)",
  "modelCompare.advanced.lead":
    "Gerçek üretimler, isteminizin üstündeki yapay zekâ modeli seçicisindeki “API anahtarları…” ile yapılandırılır (işletim sistemi destekliyorsa şifrelenir). Aşağıdaki alanlar yalnızca yerel localStorage kopyasıdır — ana boru hattını sürmez.",
  "modelCompare.p123.useMainKeys":
    "Gerçek çalışmalar için anahtarları istem alanındaki sağlayıcı menüsünün yanındaki “API anahtarları…” üzerinden girin.",
  "modelCompare.live.notImplemented":
    "Bu sürümde model karşılaştırma paneli dış API çağırmaz. Yukarıdaki referans tahminleri değişmez.",
  "modelCompare.live.whereToSee":
    "Uygulamayı oluştur veya .tq ürettiğinizde canlı sağlayıcı kullanımı (jetonlar, gecikme, model kimliği, yalnızca OpenAI tahmini maliyet) çalışma özetinde ve Ayrıntılar sekmesinde “Yapay zekâ kullanımı (bu çalışma)” altında görünür. Bu, çevrimdışı referans tablosundan ayrıdır.",
  "modelCompare.key.openai": "OpenAI API anahtarı",
  "modelCompare.key.anthropic": "Anthropic API anahtarı",
  "modelCompare.key.google": "Google AI API anahtarı",
  "modelCompare.key.placeholder": "sk-… (yalnızca yerelde)",
  "modelCompare.key.warning":
    "Anahtarlar yalnızca bu cihazdaki uygulama yerel deposuna kaydedilir. Bu sürümde hiçbir yere gönderilmez.",
  "modelCompare.key.save": "Anahtarları yerelde kaydet",
  "modelCompare.key.saved": "Kaydedildi",

  "p136.summary.title": "Lansman karşılaştırması (P136)",
  "p136.summary.badgeRef": "Referans",
  "p136.summary.honestyShort":
    "Aşağıdaki rakamlar yalnızca depodaki sabit kıyaslardan gelir (canlı API yok). USD, örnek liste fiyatlarıyla hesaplanır. Yeniden deneme, canlı başarı oranı ve kalite puanı gerçek çalıştırmalardan sonra Özet / Ayrıntılar’da görünür — bu dosyada değil.",
  "p136.summary.families": "Raporda kapsanan senaryo aileleri",
  "p136.summary.flagship": "Amiral gemisi web kabuğu",
  "p136.summary.tokenProof": "Token kanıtı paketi",
  "p136.summary.ratio": "NL ÷ TORQA",
  "p136.summary.taskTok": "Görev",
  "p136.summary.tqTok": "TORQA",
  "p136.summary.avgCompress": "Ort. istem ÷ TORQA",
  "p136.summary.scenarios": "Geçen senaryo",
  "p136.summary.liveNote": "Canlı: İstemden derle / .tq üret kullanın — o çalıştırma için yapay zekâ kullanımı ve tanılar.",
  "p136.summary.doc": "Tam anlatım: docs/COMPARISON_REPORT.md · reports/comparison_report.json",
  "p136.summary.empty": "reports/comparison_report.json okunabilsin diye depo kökünü açın; yoksa torqa-comparison-report çalıştırın.",
  "p136.family.websites": "Web siteleri",
  "p136.family.apps": "Uygulamalar",
  "p136.family.workflows": "İş akışları",
  "p136.family.automations": "Otomasyonlar",
  "p136.family.company_operations": "Şirket operasyonları",

  "bottom.runSummary": "Çalışma özeti",
  "bottom.output": "Çıktı",
  "bottom.details": "Ayrıntılar",
  "bottom.activity": "Etkinlik",
  "bottom.activity.title": "Uygulamanın yaptıklarının zaman damgalı günlüğü",
  "bottom.lastRun": "Son çalışma: {cmd}",

  "summary.intro": "Son çalışma:",
  "summary.rawOutput": "Ham komut çıktısı",
  "summary.techDetails": "Teknik ayrıntılar",
  "summary.empty": "Adım adım özet için {build} çalıştırın.",

  "output.empty": "Motorun ham komut çıktısı burada görünür.",

  "activity.fail.title": "Son çalışma — sorun",
  "activity.fail.area": "Alan:",
  "activity.area.ai": "Yapay zekâ üretimi",
  "activity.area.checks": "Üretim sonrası kontroller",
  "activity.area.setup": "Başlamadan önce",
  "activity.area.unknown": "Bilinmiyor — günlüğe bakın",
  "activity.suggested": "Önerilen düzeltmeler",
  "activity.buildFixes": "Derleme — önerilen düzeltmeler",
  "activity.empty": "{build} çalıştırdıkça etkinlik dolar.",

  "diag.suggestedFixes": "Önerilen düzeltmeler (çekirdekten)",
  "diag.details": "Ayrıntılar",
  "diag.tokenEstimates": "Jeton tahminleri",
  "diag.apiUsage": "Yapay zekâ kullanımı — süre, yeniden deneme, maliyet",
  "diag.compare": "İstem ve kayıtlı spec",
  "diag.empty": "Henüz teknik ayrıntı yok. {validate} veya {build} çalıştırın.",
  "diag.generatedPaths": "Üretilen yollar",

  "sidebar.empty.tq": "Henüz {tq} dosyası yok.",
  "sidebar.collapse": "Dosya kenar çubuğunu daralt",
  "sidebar.expand": "Dosya kenar çubuğunu genişlet",

  "banner.buildFail": "Derleme bitmedi — deneyin",
  "banner.openDetails": "Daha fazlası için Ayrıntılar’ı açın",

  "buildFailure.openOutput": "Ham günlük için Çıktı sekmesini açın.",
  "buildFailure.pip": "Depo kökünden: pip install -e . — ardından masaüstü uygulamasını yeniden başlatın.",
  "buildFailure.editTq": ".tq dosyasını düzenleyin veya projeksiyon kapsamını daraltıp yeniden Derle çalıştırın.",
  "buildFailure.noJson": "Derleme başarısız (çekirdekten JSON yok).",
  "buildFailure.generic": "Derleme başarılı olmadı.",

  "fail.noJson": "TORQA okunabilir JSON döndürmedi (ham günlük için Etkinlik’e bakın).",
  "fail.fix.core": "Çekirdeğin kurulu olduğundan emin olun: depo kökünde pip install -e . çalıştırın.",
  "fail.fix.apikey":
    "Bu adım yapay zekâ üretimiyse seçtiğiniz modelin API anahtarını veya OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY değişkenlerini ayarlayıp uygulamayı yeniden başlatın.",
  "fail.stage": "Aşama: {stage}",
  "fail.errors": "Hatalar:",
  "fail.issues": "Sorunlar:",
  "fail.code": "Kod: {code}",
  "fail.hint": "İpucu: {hint}",
  "fail.fix.prompt": "Ne istediğinize dair kısa bir açıklama yazıp yeniden Derle çalıştırın.",
  "fail.fix.openaiEnv":
    "Kullanıcı ortamınızda doğru API anahtarını ayarlayın (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY veya uygulama içi anahtarlar) ve TORQA Masaüstü’nü yeniden başlatın.",
  "fail.fix.network": "Model sağlayıcısına ağ erişimini kontrol edin.",
  "fail.fix.simplify":
    "İstemi sadeleştirin (tek ana akış, adlandırılmış girdiler) veya somut bir düzeltmeyi yeni satırda ekleyip yeniden Derle çalıştırın.",
  "fail.fix.activity": "Etkinlik sekmesini inceleyin, istemi düzenleyip yeniden deneyin.",
  "fail.incomplete": "Derleme tamamlanmadı.",

  "diag.human.issues": "Sorunlar:",
  "diag.human.warnings": "Uyarılar:",
  "diag.human.semErr": "Anlamsal hatalar:",
  "diag.human.semWarn": "Anlamsal uyarılar:",
  "diag.human.more": "… {n} tane daha",

  "editor.empty.prompt":
    "Üstten Derle’yi kullanın veya dosyalarla çalışmak için Düzenleyici’yi açın.",
  "editor.empty.advanced": "Listeden bir {tq} dosyası seçin.",

  "human.exception.fix1": "TORQA Masaüstü’nü yeniden başlatın.",
  "human.exception.fix2": "Sürerse Etkinlik günlüğünü kopyalayıp bildirim açın.",
  "human.exception.line1": "İşlem hattı çalışırken beklenmeyen hata.",

  "cmd.last.benchmarkAuto": "benchmark (otomatik: P31 klasörü veya flagship)",
  "cmd.last.benchmarkDemo": "torqa --json demo benchmark",

  "output.noJsonSurface": "(çekirdekten JSON yok — Çıktı sekmesine bakın)",
  "output.noJsonBuild": "(çekirdekten JSON yok)",
  "output.noJsonApp": "(JSON yok)",

  "save.fail.line": "{name} kaydedilemedi: {error}",
  "save.fail.fix": "Klasör izinlerini kontrol edin veya başka bir proje klasörü seçin.",

  "prompt.section.aria": "İstemden derle",
  "pipeline.steps.aria": "Derleme adımları",

  "banner.buildFail.aria": "Derleme önerilen düzeltmeler",

  "editor.resizeSplit": "Düzenleyici ve önizlemeyi yeniden boyutlandır",

  "bench.row.nlTask": "NL görevi (tahm.)",
  "bench.row.tqSurface": ".tq yüzeyi (tahm.)",
  "bench.row.irBundle": "IR paketi (tahm.)",
  "bench.row.generated": "Üretilen (tahm.)",

  "diag.moreFiles": "... {n} tane daha",

  "insight.empty.before": "Spec dosyasında teknik ayrıntı için ",
  "insight.empty.after": " çalıştırın.",

  "summary.empty.after": "adım adım özet görmek için.",
  "summary.empty.hint": "Adım adım özet için yukarıdan Derle’ye basın.",
  "activity.empty.line": "Derle’yi çalıştırdıkça etkinlik dolar.",

  "diag.empty.before": "Henüz teknik ayrıntı yok. ",
  "diag.empty.after": " veya ",
  "diag.empty.end": " çalıştırın.",

  "trial.preview.npmI": "npm install",
  "trial.preview.npmDev": "npm run dev",
  "trial.preview.webapp": "generated/webapp",

  "p135.feedback.summary": "Deneme geri bildirimi ve yerel analitik",
  "p135.feedback.privacy":
    "TORQA Desktop yalnızca bu cihazda minimal oturum olayları kaydeder (derleme denemeleri, önizleme/karşılaştırma, yeniden denemeler). Hiçbir şey otomatik olarak ağa gönderilmez. Aşağıda isteğe bağlı geri bildirim bırakabilirsiniz — JSON dosyası olarak kaydedilir; deneme iletişiminizle paylaşabilirsiniz.",
  "p135.feedback.pathsLabel": "Veri klasörü:",
  "p135.feedback.eventsLabel": "Oturum olay günlüğü (yalnızca ekleme):",
  "p135.feedback.feedbackDirLabel": "Kaydedilen geri bildirim dosyaları:",
  "p135.feedback.docHint": "Ayrıntı: TORQA deposundaki docs/P135_TRIAL_FEEDBACK.md.",
  "p135.feedback.usefulQ": "İşe yaradı mı?",
  "p135.feedback.usefulYes": "Evet",
  "p135.feedback.usefulNo": "Pek sayılmaz",
  "p135.feedback.usefulSkip": "Atla",
  "p135.feedback.failedQ": "Ne başarısız oldu? (isteğe bağlı)",
  "p135.feedback.fail.none": "Yok / uygulanamaz",
  "p135.feedback.fail.build": "Derleme / somutlaştırma",
  "p135.feedback.fail.validation": "Doğrulama / yüzey",
  "p135.feedback.fail.preview": "Önizleme",
  "p135.feedback.fail.generation": "Üretim / LLM",
  "p135.feedback.fail.other": "Diğer",
  "p135.feedback.commentLabel": "Başka bir şey? (isteğe bağlı)",
  "p135.feedback.commentPh": "Kısa notlar — gizli bilgi veya API anahtarı yazmayın.",
  "p135.feedback.save": "Geri bildirimi dosyaya kaydet",
  "p135.feedback.saving": "Kaydediliyor…",
  "p135.feedback.saved": "Kaydedildi: {path}",
  "p135.feedback.err.bridge": "Geri bildirim kaydı için Electron masaüstü uygulaması gerekir.",
};
