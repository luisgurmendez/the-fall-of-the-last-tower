type Images = {
  [id: string]: HTMLImageElement;
};

interface Asset {
  id: string;
  url: string;
}

class Assets {
  private assets: Asset[];
  public images: Images;
  private static instance: Assets;

  public static getInstance(): Assets {
    if (!Assets.instance) {
      Assets.instance = new Assets();
    }

    return Assets.instance;
  }
  private constructor() {
    this.assets = [];
    this.images = {};
  }

  loadImage = (asset: Asset) => {
    return new Promise((r) => {
      const i = new Image();
      i.onload = () => r(i);
      i.src = asset.url;
      this.images[asset.id] = i;
    });
  };

  add = (asset: Asset) => {
    this.assets.push(asset);
  };

  loadAll = () => {
    return Promise.all(this.assets.map(this.loadImage));
  };
}

export default Assets;
