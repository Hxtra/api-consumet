import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://gogoanime.by';
const AJAX_URL = 'https://ajax.gogo-load.com/ajax';

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
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: BASE_URL,
    },
  });

  async search(query: string, page: number = 1): Promise<SearchResult[]> {
    const { data } = await this.client.get(`${AJAX_URL}/SearchResult`, {
      params: { keyw: query },
    });
    const $ = cheerio.load(data);
    const results: SearchResult[] = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const id = href.replace(`${BASE_URL}/category/`, '');
      const title = $(el).find('img').attr('alt')?.trim() || '';
      const image = $(el).find('img').attr('src') || '';
      results.push({ id, title, image, url: `${BASE_URL}/category/${id}` });
    });
    return results;
  }

  async fetchAnimeInfo(animeId: string): Promise<AnimeInfo> {
    const { data } = await this.client.get(`${BASE_URL}/category/${animeId}`);
    const $ = cheerio.load(data);

    const title = $('.anime_info_body_bg h1').text().trim();
    const image = $('.anime_info_body_bg img').attr('src') || '';
    const description = $('.description p').text().trim();

    const genres: string[] = [];
    $('p.type:contains("Genre") a').each((_, el) => {
      genres.push($(el).text().trim());
    });

    const status = $('p.type:contains("Status") a').text().trim();
    const type = $('p.type:contains("Type") a').text().trim();
    const releaseDate = $('p.type:contains("Released")').text().replace('Released:', '').trim();
    const otherName = $('p.type:contains("Other name")').text().replace('Other name:', '').trim();

    const epStart = parseInt($('#ep_related .anime_name').attr('style')?.match(/--ep_start:\s*(\d+)/)?.[1] || '0');
    const movieId = $('#movie_id').val() as string;

    let episodes: Episode[] = [];
    if (movieId) {
      const epRes = await this.client.get(`${AJAX_URL}/load-list-episode`, {
        params: { ep_start: 0, ep_end: 10000, id: movieId },
      });
      const ep$ = cheerio.load(epRes.data);
      ep$('li').each((_, el) => {
        const href = ep$(el).find('a').attr('href') || '';
        const epNum = parseInt(href.split('-episode-').pop() || '0');
        const id = href.replace(/^\//, '');
        if (id) episodes.push({ id, number: epNum, url: `${BASE_URL}/${id}` });
      });
      episodes = episodes.reverse();
    }

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
    const { data } = await this.client.get(`${BASE_URL}/${episodeId}`);
    const $ = cheerio.load(data);

    const sources: Source[] = [];

    $('.anime_muti_link a').each((_, el) => {
      const url = $(el).attr('data-video') || $(el).attr('href') || '';
      const server = $(el).text().trim();
      if (url) sources.push({ url, quality: 'default', server });
    });

    return sources;
  }

  async fetchRecentEpisodes(page: number = 1): Promise<{ episodeId: string; animeId: string; title: string; image: string; episodeNumber: number }[]> {
    const { data } = await this.client.get(`${BASE_URL}/home.html`, {
      params: { page },
    });
    const $ = cheerio.load(data);
    const results: any[] = [];
    $('.last_episodes ul.items li').each((_, el) => {
      const title = $(el).find('.name a').text().trim();
      const image = $(el).find('img').attr('src') || '';
      const href = $(el).find('.name a').attr('href') || '';
      const animeId = href.replace('/category/', '');
      const epLink = $(el).find('.episode a').attr('href') || '';
      const episodeId = epLink.replace(/^\//, '');
      const episodeNumber = parseInt($(el).find('.episode').text().replace(/[^0-9]/g, '') || '0');
      results.push({ episodeId, animeId, title, image, episodeNumber });
    });
    return results;
  }
}

export default GogoanimeScraper;
