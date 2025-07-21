import CacheReference from "#models/cache_reference";

export default class CacheReferenceController {
  async index() {
    const cacheRefNum = await CacheReference.query().first();
    return {
      data: {
        cacheRefNum,
      },
    };
  }

  async bump() {
    await CacheReference.bumpCache();
  }
}
