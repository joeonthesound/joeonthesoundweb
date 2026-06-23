import { afterFirstPaint, mountTikTokEmbeds } from './uiEffects.js';

function tiktokEmbed(video, profileUrl) {
  return `
    <blockquote class="tiktok-embed" cite="${profileUrl}/video/${video.id}" data-video-id="${video.id}">
      <section><a href="${profileUrl}" target="_blank" rel="noopener noreferrer">${profileUrl}</a></section>
    </blockquote>`;
}

export function renderSobreJoe({ container, dictionary, assets }) {
  const about = dictionary.about;
  const [portraitOne, portraitTwo] = assets.tiktok.videos;
  const landscape = assets.aboutMedia.landscapeVideo;

  container.innerHTML = `
    <section class="page about-page">
      <div class="shell">
        <header class="about-hero rv">
          <div>
            <p class="eyebrow">${about.eyebrow}</p>
            <h1 class="heading-primary">${about.title}</h1>
            <span class="about-role">${about.role}</span>
          </div>
          <p class="about-intro">${about.p1}</p>
        </header>

        <div class="about-timeline">
          <article class="about-chapter">
            <div class="about-copy rv"><p>${about.p2}</p></div>
            <figure class="about-media about-media--portrait rv">
              <div class="tiktok-frame tiktok-frame--portrait">${tiktokEmbed(portraitOne, assets.tiktok.profileUrl)}</div>
              <figcaption>${about.mediaLabels[0]}</figcaption>
            </figure>
          </article>

          <article class="about-chapter about-chapter--reverse">
            <div class="about-copy rv">
              <p>${about.p3}</p>
              <strong class="about-signature">${about.signature}</strong>
            </div>
            <figure class="about-media about-media--portrait rv">
              <div class="tiktok-frame tiktok-frame--portrait">${tiktokEmbed(portraitTwo, assets.tiktok.profileUrl)}</div>
              <figcaption>${about.mediaLabels[1]}</figcaption>
            </figure>
          </article>

          <article class="about-technology rv">
            <p>${about.p4}</p>
          </article>

          <article class="about-feature">
            <div class="about-copy rv"><p>${about.p5}</p></div>
            <figure class="about-media about-media--landscape rv">
              <div class="responsive-embed responsive-embed--landscape">
                <iframe src="${landscape.embedUrl}" title="${landscape.title}" loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
              </div>
              <figcaption>${about.mediaLabels[2]}</figcaption>
            </figure>
          </article>

          <footer class="about-closing rv">
            <p>${about.p6}</p>
          </footer>
        </div>
      </div>
    </section>`;

  afterFirstPaint(() => mountTikTokEmbeds(assets.tiktok.embedScript));
}
