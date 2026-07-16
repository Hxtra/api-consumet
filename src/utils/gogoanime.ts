import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE = 'https://gogoanime.co.za';

interface AnimeInfo {
  id: string;
  title: string;
  image: string;
  description: string;
  genres: string[];
  status: string;
  type: string;
  releaseDate: string;
  otherName: string;
}

interface Source {
  url: string;
  quality: string;
  server: string;
}

const client = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  },
});

class GogoanimeScraper {
  async fetchAnimeInfo(animeId: string): Promise<AnimeInfo> {
    const slug = animeId.replace(/^anime\//, '').replace(/\/$/, '');
    const { data } = await client.get(`${BASE}/anime/${slug}/`);
    const $ = cheerio.load(data);

    const title = $('h1.entry-title').text().trim();
    const image =
      $('.thumb img').attr('src') || $('.thumbook img').first().attr('src') || '';
    const description =
      $('.bixbox.synp .entry-content').text().trim() ||
      $('.info-content .desc').text().trim() ||
      '';
    const genres: string[] = [];
    $('.genxed a').each((_, el) => {
      const g = $(el).text().trim();
      if (g) genres.push(g);
    });

    const getSpeText = (label: string): string => {
      const el = $(`.spe span`).filter((_, e) => $(e).text().includes(label));
      return el.text().replace(label, '').replace(/^:\s*/, '').trim();
    };

    const status = getSpeText('Status');
    const type = getSpeText('Type');
    const releaseDate = getSpeText('Released');
    const otherName = $('span.alter').text().trim() || getSpeText('Other name');

    return {
      id: slug,
      title,
      image,
      description,
      genres,
      status,
      type,
      releaseDate,
      otherName,
    };
  }

  async fetchEpisodeSources(episodeId: string): Promise<Source[]> {
    const path = episodeId.startsWith('/') ? episodeId : `/${episodeId}`;
    const { data } = await client.get(`${BASE}${path}`);
    const $ = cheerio.load(data);

    const sources: Source[] = [];
    $('iframe[src]').each((_, el) => {
      const url = $(el).attr('src') || '';
      if (url && !url.includes('disqus')) {
        sources.push({ url, quality: 'default', server: 'embed' });
      }
    });
    $('a[data-video], a[data-src]').each((_, el) => {
      const url = $(el).attr('data-video') || $(el).attr('data-src') || '';
      const server = $(el).text().trim() || 'default';
      if (url) sources.push({ url, quality: 'default', server });
    });
    return sources;
  }

  async fetchRecentEpisodes(
    page: number = 1,
  ): Promise<
    { episodeId: string; animeId: string; title: string; image: string; episodeNumber: number }[]
  > {
    const { data } = await client.get(`${BASE}/page/${page}/`);
    const $ = cheerio.load(data);
    const results: any[] = [];
    $('.listupd article.bs, .listupd .bs').each((_, el) => {
      const href = $(el).find('a').first().attr('href') || '';
      const epMatch = href.match(/-episode-(\d+)\/$/);
      if (epMatch) {
        const episodeNumber = parseInt(epMatch[1]);
        const title =
          $(el).find('a').attr('title') || $(el).find('.tt').text().trim();
        const image = $(el).find('img').attr('src') || '';
        const animeId = href
          .replace(`${BASE}/anime/`, '')
          .replace(/-episode-\d+\/$/, '')
          .replace(/\/$/, '');
        const episodeId = href.replace(`${BASE}/`, '');
        results.push({ episodeId, animeId, title, image, episodeNumber });
      }
    });
    return results;
  }
}

export default GogoanimeScraper;
