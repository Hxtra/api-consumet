import axios from 'axios';
import * as cheerio from 'cheerio';

const DOMAINS = [
  'https://gogoanime.co.za',
  'https://gogoanime.by',
  'https://gogoanime.cl',
];

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

class GogoanimeScraper {
  private client = axios.create({
    timeout: 10000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  private baseUrl = DOMAINS[0];

  private async tryDomains(path: string): Promise<{ data: string; usedDomain: string }> {
    for (const domain of DOMAINS) {
      try {
        const { data } = await this.client.get(`${domain}${path}`);
        if (data && data.length > 100) {
          this.baseUrl = domain;
          return { data, usedDomain: domain };
        }
      } catch {
        continue;
      }
    }
    throw new Error(`All Gogoanime domains failed for path: ${path}`);
  }

  async search(query: string, page: number = 1): Promise<SearchResult[]> {
    const { data } = await this.tryDomains(
      `/search.html?keyword=${encodeURIComponent(query)}&page=${page}`,
    );
    const $ = cheerio.load(data);
    const results: SearchResult[] = [];
    $('.last_episodes ul.items li, .items li').each((_, el) => {
      const title = $(el).find('.name a, .img a').attr('title')?.trim() || $(el).find('.name').text().trim();
      const href = $(el).find('.name a, .img a').attr('href') || '';
      const id = href.replace('/category/', '');
      const image = $(el).find('img').attr('src') || '';
      if (id) results.push({ id, title, image, url: `${this.baseUrl}/category/${id}` });
    });
    return results;
  }

  async fetchAnimeInfo(animeId: string): Promise<AnimeInfo> {
    const { data } = await this.tryDomains(`/category/${animeId}`);
    const $ = cheerio.load(data);

    const title =
      $('.anime_info_body_bg h1').text().trim() ||
      $('.anime-info-title, h1').first().text().trim() ||
      $('h2:first').text().trim();

    const image =
      $('.anime_info_body_bg img').attr('src') ||
      $('.anime-poster img, .poster img').attr('src') ||
      '';

    const description =
      $('.description p').text().trim() || $('.synopsis p, .description').text().trim() || '';

    const genres: string[] = [];
    $('p.type:contains("Genre") a, .genres a, .genre a').each((_, el) => {
      const g = $(el).text().trim();
      if (g) genres.push(g);
    });

    const status = $('p.type:contains("Status") a, .status').text().trim();
    const type = $('p.type:contains("Type") a, .type').text().trim();
    const releaseDate = $('p.type:contains("Released")')
      .text()
      .replace('Released:', '')
      .trim();
    const otherName = $('p.type:contains("Other name")')
      .text()
      .replace('Other name:', '')
      .trim();

    const episodes: Episode[] = [];
    $('#episode_related a, .episode-list a, .episodes a, .anime_video_body li a').each(
      (_, el) => {
        const href = $(el).attr('href') || '';
        const epNum = parseInt(href.split('-episode-').pop() || '0');
        const id = href.replace(/^\//, '');
        if (id) episodes.push({ id, number: epNum, url: `${this.baseUrl}/${id}` });
      },
    );

    return {
      id: animeId,
      title,
      image,
      description,
      genres,
      status,
      type,
      releaseDate,
      otherName,
      episodes,
    };
  }

  async fetchEpisodeSources(episodeId: string): Promise<Source[]> {
    const { data } = await this.tryDomains(`/${episodeId}`);
    const $ = cheerio.load(data);

    const sources: Source[] = [];

    $('.anime_muti_link a, .links a, #links a, .server-item a').each((_, el) => {
      const url = $(el).attr('data-video') || $(el).attr('data-src') || $(el).attr('href') || '';
      const server = $(el).text().trim() || $(el).attr('data-server') || 'default';
      if (url && !url.startsWith('#')) sources.push({ url, quality: 'default', server });
    });

    return sources;
  }

  async debugHtml(): Promise<string> {
    try {
      const res = await this.client.get('https://gogoanime.co.za/category/one-piece');
      return res.data.substring(0, 5000);
    } catch (err) {
      return `Error: ${err}`;
    }
  }

  async fetchRecentEpisodes(
    page: number = 1,
  ): Promise<
    { episodeId: string; animeId: string; title: string; image: string; episodeNumber: number }[]
  > {
    const { data } = await this.tryDomains(`/?page=${page}`);
    const $ = cheerio.load(data);
    const results: any[] = [];
    $('.last_episodes ul.items li, .last_episodes li, .items li').each((_, el) => {
      const title = $(el).find('.name a').text().trim() || $(el).find('a').attr('title')?.trim() || '';
      const image = $(el).find('img').attr('src') || '';
      const href = $(el).find('.name a').attr('href') || $(el).find('a').attr('href') || '';
      const animeId = href.replace('/category/', '');
      const epLink = $(el).find('.episode a').attr('href') || '';
      const episodeId = epLink.replace(/^\//, '');
      const episodeNumber = parseInt($(el).find('.episode').text().replace(/[^0-9]/g, '') || '0');
      if (animeId) results.push({ episodeId, animeId, title, image, episodeNumber });
    });
    return results;
  }
}

export default GogoanimeScraper;
