import { useEffect, useRef, useState } from "react";
import "./App.css";

import bowImg from "./assets/bow.png";
import cakeImg from "./assets/cake3.png";
import catImg from "./assets/cat.png";
import popperImg from "./assets/popper.png";
import cake2Img from "./assets/cake2.webp";
import catYarnImg from "./assets/猫毛线球-裁剪.png";
import fireworksImg from "./assets/fireworks.png";

import { getWishes, saveWish } from "./database";

const memorialPhotoModules = import.meta.glob(
  "./assets/memories/*.{png,jpg,jpeg,webp,gif}",
  {
    eager: true,
    import: "default",
  },
);

const memorialPhotos = Object.entries(memorialPhotoModules).map(
  ([path, imageData], index) => {
    const filename = path.split("/").pop() ?? `memory-${index + 1}`;
    const cleanName = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");

    return {
      id: `memorial-${path}`,
      imageData,
      name: cleanName || `Memory ${index + 1}`,
      source: "memorial",
    };
  },
);

const editorialCards = [
  {
    id: "editorial-for-ember",
    type: "editorial",
    eyebrow: "BIRTHDAY ARCHIVE",
    title: "FOR EMBER",
    text: "A collection of little moments.",
    variant: "black",
  },
  {
    id: "editorial-mtg",
    type: "editorial",
    eyebrow: "MIAO TIAN GE",
    title: "2026",
    text: "Made by all of us.",
    variant: "white",
  },
  {
    id: "editorial-memories",
    type: "editorial",
    eyebrow: "MEMORIES",
    title: "KEEP THIS",
    text: "Some moments deserve a page of their own.",
    variant: "pink",
  },
];

function shuffleItems(items) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }

  return next;
}

const MAX_IMAGE_BYTES = 650_000;
const MAX_IMAGE_SIDE = 1200;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("无法读取图片。"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("浏览器无法处理这张图片。"));
    image.src = dataUrl;
  });
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件。");
  }

  const originalDataUrl = await fileToDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const scale = Math.min(
    1,
    MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("图片处理失败。");
  }

  context.drawImage(image, 0, 0, width, height);
  let quality = 0.82;
  let compressed = canvas.toDataURL("image/jpeg", quality);

  while (compressed.length > MAX_IMAGE_BYTES * 1.37 && quality > 0.42) {
    quality -= 0.08;
    compressed = canvas.toDataURL("image/jpeg", quality);
  }

  if (compressed.length > MAX_IMAGE_BYTES * 1.37) {
    throw new Error("图片仍然太大，请换一张尺寸更小的图片。");
  }

  return compressed;
}

function App() {
  const cakeRevealRef = useRef(null);

  const [screen, setScreen] = useState(
    window.location.pathname === "/write" ? "write" : "home",
  );
  const [viewMode, setViewMode] = useState("album");
  const [currentIndex, setCurrentIndex] = useState(0);

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [imageData, setImageData] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [wishes, setWishes] = useState([]);
  const [isLoadingWishes, setIsLoadingWishes] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [galleryItems, setGalleryItems] = useState([]);

  useEffect(() => {
    if (screen !== "home") return undefined;

    let animationFrame = null;

    const updateCakeReveal = () => {
      const cake = cakeRevealRef.current;
      if (!cake) return;

      const rect = cake.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const start = viewportHeight * 0.98;
      const end = viewportHeight * 0.58;

      const progress = Math.min(
        1,
        Math.max(0, (start - rect.top) / (start - end)),
      );

      const translateY = 24 * (1 - progress);
      const opacity = 0.62 + 0.38 * progress;
      const blur = 5 * (1 - progress);

      cake.style.setProperty("--cake-y", `${translateY.toFixed(2)}px`);
      cake.style.setProperty("--cake-opacity", opacity.toFixed(3));
      cake.style.setProperty("--cake-blur", `${blur.toFixed(2)}px`);
      cake.classList.toggle("cake-complete", progress >= 0.995);
    };

    const requestUpdate = () => {
      if (animationFrame !== null) return;

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        updateCakeReveal();
      });
    };

    updateCakeReveal();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);

      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== "wishes") return;

    let cancelled = false;

    async function loadWishes() {
      setIsLoadingWishes(true);
      setLoadError("");

      try {
        const data = await getWishes();

        if (!cancelled) {
          setWishes(data);
          setCurrentIndex(0);
        }
      } catch (error) {
        console.error("Failed to load wishes:", error);

        if (!cancelled) {
          setLoadError("祝福暂时加载失败，请稍后刷新重试。");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWishes(false);
        }
      }
    }

    loadWishes();

    return () => {
      cancelled = true;
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== "gallery") return;

    const uploadedPhotos = wishes
      .filter((wish) => wish.imageData)
      .map((wish) => ({
        ...wish,
        source: "submitted",
      }));

    const combinedItems = [
      ...uploadedPhotos,
      ...memorialPhotos,
      ...(uploadedPhotos.length + memorialPhotos.length >= 6
        ? editorialCards
        : []),
    ];

    setGalleryItems(shuffleItems(combinedItems));
  }, [screen, wishes]);

  useEffect(() => {
    if (!lightboxPhoto) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setLightboxPhoto(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [lightboxPhoto]);

  const currentWish = wishes[currentIndex] ?? null;
  const photoWishes = wishes.filter((wish) => wish.imageData);

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setIsProcessingImage(true);
    setImageError("");

    try {
      const compressedImage = await compressImage(file);
      setImageData(compressedImage);
    } catch (error) {
      console.error("Failed to process image:", error);
      setImageError(error.message || "图片处理失败，请换一张图片。");
    } finally {
      setIsProcessingImage(false);
    }
  }

  function removeImage() {
    setImageData("");
    setImageError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanName = name.trim();
    const cleanMessage = message.trim();

    if (!cleanMessage) {
      setSubmitError("请先写下你的生日祝福。");
      return;
    }

    if (isProcessingImage) {
      setSubmitError("图片还在处理中，请稍等一下。");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await saveWish(cleanName, cleanMessage, imageData);
      setSubmitted(true);
      setName("");
      setMessage("");
      setImageData("");
    } catch (error) {
      console.error("Failed to save wish:", error);
      setSubmitError("提交失败，请稍后再试一次。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function showPreviousWish() {
    if (wishes.length === 0) return;

    setCurrentIndex((current) =>
      current === 0 ? wishes.length - 1 : current - 1,
    );
  }

  function showNextWish() {
    if (wishes.length === 0) return;

    setCurrentIndex((current) =>
      current === wishes.length - 1 ? 0 : current + 1,
    );
  }

  return (
    <main
      className={`page ${screen === "home" ? "home-page" : ""} ${
        screen === "ending" ? "ending-page" : ""
      }`}
    >
      {screen === "home" && (
        <section className="welcome-screen">
          <div className="home-sparkles" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => (
              <span key={index} className={`sparkle sparkle-${index + 1}`}>
                {index % 2 === 0 ? "✦" : "✧"}
              </span>
            ))}
          </div>

          <img src={bowImg} className="home-bow" alt="" />
          <img src={catImg} className="home-cat" alt="" />

          <div className="gift-logo" aria-hidden="true">
            <span className="gift-glow" />
            <span className="gift-emoji">🎁</span>
          </div>

          <p className="small-title">A SPECIAL GIFT FOR</p>

          <div className="title-divider" aria-hidden="true">
            <span>────────</span>
            <b>✦</b>
            <span>────────</span>
          </div>

          <h1 className="name-title">Ember</h1>

          <p className="description">
            锵锵！
            <br />
            这里有一份礼物待查收 ✨
          </p>

          <button
            className="primary-button"
            onClick={() => setScreen("birthday")}
          >
            ✦ 拆开 ✦
          </button>

          <div
            ref={cakeRevealRef}
            className="home-cake-reveal"
            aria-hidden="true"
          >
            <img src={cakeImg} className="home-cake" alt="" />
          </div>
        </section>
      )}

      {screen === "birthday" && (
        <section className="birthday-screen">
          <div className="birthday-sparkles" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <span
                key={index}
                className={`birthday-sparkle birthday-sparkle-${index + 1}`}
              >
                {index % 2 === 0 ? "✦" : "✧"}
              </span>
            ))}
          </div>

          <div className="celebration">
            <img src={popperImg} alt="popper" className="popper-image" />
          </div>

          <div className="divider-line" aria-hidden="true">
            <span />
            <span className="divider-star">✦</span>
            <span />
          </div>

          <p className="small-title">TODAY IS YOUR DAY</p>

          <h1 className="birthday-title">
            Happy Birthday,
            <br />
            Ember!
          </h1>

          <p className="description">
            这些祝福，
            <br />
            都是大家想亲口对你说的话。
          </p>

          <img src={cake2Img} alt="" className="birthday-cake-slice" />

          <button
            className="primary-button"
            onClick={() => setScreen("wishes")}
          >
            查看大家的祝福
          </button>
        </section>
      )}

      {screen === "write" && (
        <section className="write-screen">
          {!submitted ? (
            <>
              <div className="write-heading">
                <div className="letter-icon">💌</div>
                <p className="small-title">A LITTLE SURPRISE FOR EMBER</p>
                <h1>留下你的祝福</h1>
                <p>
                  我们正在悄悄准备一份生日礼物。
                  <br />
                  请写下你想亲口对 Ember 说的话。
                </p>
              </div>

              <form className="wish-form" onSubmit={handleSubmit}>
                <label className="form-field">
                  <span>你的昵称</span>
                  <small>可留空，届时会显示为“一位朋友”</small>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="例如：秋月"
                    maxLength={30}
                    disabled={isSubmitting}
                  />
                </label>

                <label className="form-field">
                  <span>生日祝福</span>
                  <small>写下你最想对 Ember 说的话</small>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Happy Birthday, Ember..."
                    rows={7}
                    maxLength={1000}
                    required
                    disabled={isSubmitting}
                  />
                  <div className="character-count">{message.length} / 1000</div>
                </label>

                <div className="form-field">
                  <span>添加一张照片</span>
                  <small>可选。图片会先自动压缩，再和祝福一起保存。</small>

                  {!imageData ? (
                    <label className="image-upload-box">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleImageChange}
                        disabled={isSubmitting || isProcessingImage}
                      />
                      <span className="upload-plus">
                        {isProcessingImage ? "…" : "＋"}
                      </span>
                      <strong>
                        {isProcessingImage ? "正在处理图片" : "添加照片"}
                      </strong>
                      <small>
                        {isProcessingImage
                          ? "请稍等一下"
                          : "点击这里从手机或电脑选择图片"}
                      </small>
                    </label>
                  ) : (
                    <div className="image-preview-box">
                      <img src={imageData} alt="你选择的照片预览" />

                      <div className="image-actions">
                        <label className="change-image-button">
                          更换照片
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={handleImageChange}
                            disabled={isSubmitting || isProcessingImage}
                          />
                        </label>

                        <button
                          type="button"
                          className="remove-image-button"
                          onClick={removeImage}
                          disabled={isSubmitting}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  )}

                  {imageError && (
                    <p className="image-error" role="alert">
                      {imageError}
                    </p>
                  )}
                </div>

                {submitError && (
                  <p className="form-error" role="alert">
                    {submitError}
                  </p>
                )}

                <button
                  className="submit-button"
                  type="submit"
                  disabled={isSubmitting || isProcessingImage}
                >
                  {isSubmitting ? "正在放进礼物盒…" : "把祝福放进礼物盒 🎁"}
                </button>

                <p className="privacy-note">
                  你提交后不会看到其他人的祝福，所有内容会在生日当天一起揭晓。
                </p>
              </form>
            </>
          ) : (
            <section className="success-screen">
              <div className="success-icon">✨</div>
              <p className="small-title">WISH RECEIVED</p>
              <h1>已经放进礼物盒啦</h1>
              <p>
                谢谢你为 Ember 留下这份祝福。
                <br />
                她会在生日当天看到它。
              </p>
              <div className="closed-gift">🎁</div>
            </section>
          )}
        </section>
      )}

      {screen === "wishes" && (
        <section className="wishes-screen">
          <div className="wishes-decorations" aria-hidden="true">
            <span className="wishes-deco wishes-deco-1">✦</span>
            <span className="wishes-deco wishes-deco-2">♡</span>
            <span className="wishes-deco wishes-deco-3">✧</span>
            <span className="wishes-deco wishes-deco-4">🎀</span>
            <span className="wishes-deco wishes-deco-5">✦</span>
            <span className="wishes-deco wishes-deco-6">♡</span>
            <span className="wishes-deco wishes-deco-7">✧</span>
            <span className="wishes-deco wishes-deco-8">💌</span>
          </div>

          <div className="wishes-header">
            <div className="wishes-title">
              <p className="small-title">BIRTHDAY WISHES</p>
              <h2>来自大家的祝福</h2>
            </div>

            {wishes.length > 0 && (
              <div className="view-switcher">
                <button
                  className={viewMode === "album" ? "active" : ""}
                  onClick={() => setViewMode("album")}
                >
                  ◉ 相册
                </button>
                <button
                  className={viewMode === "grid" ? "active" : ""}
                  onClick={() => setViewMode("grid")}
                >
                  ▦ 全部
                </button>
              </div>
            )}
          </div>

          {isLoadingWishes && (
            <div className="status-card">
              <div className="status-icon">💌</div>
              <h3>正在打开大家的祝福…</h3>
            </div>
          )}

          {!isLoadingWishes && loadError && (
            <div className="status-card">
              <div className="status-icon">💌</div>
              <h3>暂时没有打开成功</h3>
              <div className="divider" />
              <p>{loadError}</p>
            </div>
          )}

          {!isLoadingWishes && !loadError && wishes.length === 0 && (
            <div className="status-card">
              <div className="status-icon">💌</div>
              <p className="from">Waiting</p>
              <h3>祝福正在悄悄赶来</h3>
              <div className="divider" />
              <p>礼物盒现在还是空的，但很快就会装满大家想对你说的话。</p>
            </div>
          )}

          {!isLoadingWishes &&
            !loadError &&
            wishes.length > 0 &&
            viewMode === "album" &&
            currentWish && (
              <div className="album-view">
                <div className="album-progress">
                  {currentIndex + 1} / {wishes.length}
                </div>

                <article className="wish-card large-card" key={currentWish.id}>
                  {currentWish.imageData ? (
                    <button
                      type="button"
                      className="wish-photo-button"
                      onClick={() => setLightboxPhoto(currentWish)}
                      aria-label={`放大查看 ${currentWish.name} 上传的照片`}
                    >
                      <img
                        src={currentWish.imageData}
                        alt={`${currentWish.name} 上传的照片`}
                        className="wish-photo"
                      />
                    </button>
                  ) : (
                    <div className="wish-emoji">💌</div>
                  )}
                  <p className="from">From</p>
                  <h3>{currentWish.name}</h3>
                  <div className="divider" />
                  <p className="wish-message">{currentWish.message}</p>
                </article>

                <div className="album-controls">
                  <button className="circle-button" onClick={showPreviousWish}>
                    ←
                  </button>

                  <div className="dots">
                    {wishes.map((wish, index) => (
                      <button
                        key={wish.id}
                        className={`dot ${
                          index === currentIndex ? "selected" : ""
                        }`}
                        onClick={() => setCurrentIndex(index)}
                        aria-label={`查看第 ${index + 1} 条祝福`}
                      />
                    ))}
                  </div>

                  <button className="circle-button" onClick={showNextWish}>
                    →
                  </button>
                </div>

              </div>
            )}

          {!isLoadingWishes &&
            !loadError &&
            wishes.length > 0 &&
            viewMode === "grid" && (
              <div className="all-wishes-view">
                <div className="preview-grid">
                  {wishes.map((wish, index) => (
                    <button
                      className="preview-card"
                      key={wish.id}
                      onClick={() => {
                        setCurrentIndex(index);
                        setViewMode("album");
                      }}
                    >
                      {wish.imageData ? (
                        <img
                          src={wish.imageData}
                          alt=""
                          className="preview-photo"
                        />
                      ) : (
                        <span className="preview-emoji">💌</span>
                      )}
                      <span className="preview-name">{wish.name}</span>
                      <span className="preview-message">{wish.message}</span>
                      <span className="read-more">打开这张祝福 →</span>
                    </button>
                  ))}
                </div>

                <button
                  className="primary-button all-wishes-continue"
                  onClick={() =>
                    setScreen(photoWishes.length > 0 || memorialPhotos.length > 0 ? "gallery" : "ending")
                  }
                >
                  看完祝福，继续 →
                </button>
              </div>
            )}
        </section>
      )}
      {screen === "gallery" && (
        <section className="gallery-screen">
          <div className="gallery-ambient" aria-hidden="true">
            <span className="gallery-orbit gallery-orbit-1" />
            <span className="gallery-orbit gallery-orbit-2" />
            <span className="gallery-grain" />
          </div>

          <div className="gallery-content">
            <div className="gallery-heading">
              <p className="small-title">OUR MEMORIES</p>

              <div className="gallery-divider" aria-hidden="true">
                <span />
                <b>✦</b>
                <span />
              </div>

              <h2>照片墙</h2>
              <p className="gallery-subtitle">
                A little archive of the moments we chose to keep.
              </p>
            </div>

            <div className="photo-wall">
              {galleryItems.map((item, index) => {
                if (item.type === "editorial") {
                  return (
                    <article
                      key={item.id}
                      className={`editorial-tile editorial-${item.variant}`}
                    >
                      <span>{item.eyebrow}</span>
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                    </article>
                  );
                }

                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`photo-wall-item magazine-layout-${(index % 10) + 1} ${
                      item.source === "memorial"
                        ? "photo-wall-item-memorial"
                        : ""
                    }`}
                    onClick={() => setLightboxPhoto(item)}
                    aria-label={`放大查看 ${item.name} 的照片`}
                  >
                    <img src={item.imageData} alt={`${item.name} 的照片`} />

                    <span className="magazine-corner magazine-corner-top" aria-hidden="true" />
                    <span className="magazine-corner magazine-corner-bottom" aria-hidden="true" />

                    <span className="photo-wall-caption">
                      <small>
                        {item.source === "memorial" ? "MEMORY" : "FROM"}
                      </small>
                      <b>{item.name}</b>
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              className="primary-button gallery-continue"
              onClick={() => setScreen("ending")}
            >
              继续拆开最后一页 →
            </button>

            <div className="gallery-bottom-decoration" aria-hidden="true">
              <img
                src={catYarnImg}
                alt=""
                className="gallery-cat-yarn"
                draggable="false"
              />
            </div>
          </div>
        </section>
      )}
      {screen === "ending" && (
        <section className="ending-screen">
          <img
            src={fireworksImg}
            alt=""
            className="ending-fireworks ending-fireworks-left"
            aria-hidden="true"
            draggable="false"
          />

          <p>Here's to today.</p>

          <p>
            Here's to joy,
            <br />
            to laughter,
            <br />
            and to everything beautiful ahead.
          </p>

          <h2>Happy Birthday, Ember. ❤️</h2>

          <div className="ending-signature">
            <span>With love,</span>
            <strong>妙天阁 &amp; Friends ❤️</strong>
          </div>

          <img
            src={fireworksImg}
            alt=""
            className="ending-fireworks ending-fireworks-right"
            aria-hidden="true"
            draggable="false"
          />

          <span className="hidden-credit">Designed by 秋月.</span>
        </section>
      )}

      {lightboxPhoto && (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="照片放大预览"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setLightboxPhoto(null)}
            aria-label="关闭照片"
          >
            ×
          </button>

          <div
            className="lightbox-content"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={lightboxPhoto.imageData}
              alt={`${lightboxPhoto.name} 上传的照片`}
            />
            <p>From {lightboxPhoto.name}</p>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;