import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE = 'https://gogoanime.co.za';

interface SearchResult {
  id: string;
  title: string;
  image: string;
  url: string;
}

interface Episode {
  id: string;
  number: number;
  url: string;
}

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
  episodes: Episode[];
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
  async search(query: string, _page: number = 1): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const terms = query.toLowerCase().split(/\s+/);

    for (let page = 1; page <= 3; page++) {
      try {
        const { data } = await client.get(`${BASE}/page/${page}/`);
        const $ = cheerio.load(data);
        $('.listupd article.bs, .listupd .bs').each((_, el) => {
          const link = $(el).find('a').first();
          const href = link.attr('href') || '';
          const id = href.replace(`${BASE}/anime/`, '').replace(/\/$/, '');
          const title = link.attr('title') || $(el).find('.tt').text().trim() || '';
          const image = $(el).find('img').attr('src') || '';
          if (
            id &&
            terms.every((t) => title.toLowerCase().includes(t)) &&
            !href.includes('-episode-') &&
            !results.find((r) => r.id === id)
          ) {
            results.push({ id, title, image, url: href });
          }
        });
      } catch {
        break;
      }
    }
    return results;
  }

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

    const episodes: Episode[] = [];
    const epPattern = new RegExp(
      `${slug.replace(/[.+?^${}()|[\]\\]/g, '\\$&')}-episode-(\\d+)/?$`,
    );
    $('a[href*="episode"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(epPattern);
      if (match) {
        episodes.push({
          id: href.replace(`${BASE}/`, ''),
          number: parseInt(match[1]),
          url: href,
        });
      }
    });

    const unique = [...new Map(episodes.map((e) => [e.number, e])).values()].sort(
      (a, b) => b.number - a.number,
    );

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
      episodes: unique,
    };
  }

  async debug(page: number): Promise<string> {
    try {
      const { data } = await client.get(`${BASE}/page/${page}/`);
      const $ = cheerio.load(data);
      const items: string[] = [];
      $('.listupd > *').each((_, el) => {
        const tag = $(el).prop('tagName')?.toLowerCase() || '';
        const cls = $(el).attr('class') || '';
        const href = $(el).find('a').first().attr('href') || '';
        if (href) items.push(`${tag}.${cls}: ${href.substring(0,80)}`);
      });
      return items.slice(0, 30).join('\n') || 'no items';
    } catch (err) {
      return `Error: ${err}`;
    }
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
