var jf = require('jsonfile'),
    sandcrawler = require('sandcrawler'),
    logger = require('sandcrawler-logger'),
    dashboard = require('sandcrawler-dashboard'),
    results = [],
    logConf = {
      level: 'verbose',
      pageLog: false
    };
jf.spaces = 2;

var droid = sandcrawler.phantomDroid()
  .use(logger(logConf))
  //.use(dashboard({logger: logConf}))
  .config({
    timeout: 30000,
    maxRetries: 5
  })
  .throttle(1000, 2500)
  .url({
    url: 'http://www.priceminister.com/s/megadrive?nav=Jeux-Video-et-Consoles_Jeux-Video',
    data: {type: 'search'}
  })
  .scraper(function($, done) {
    var output = {};
    // scrape items from search pages
    if (window.location.href.indexOf('priceminister.com/s/') != -1) {
    // TODO : get nextPage
      output.nextPage = null;
      output.items = $('.productNav.photoSize_MML .product').scrape({
        title: {sel: 'h3.productName'},
        url: {sel: 'a.productLnk', attr: 'href'},
        img: {sel: '.productPhoto img.photo', attr: 'src'}
      });
    }
    // scrape announces from item's page
    else {
      // TODO click on display more if present

      output.announces = $('#advert_list tbody tr').scrape({
        url: {sel: '.actionLnk li .see_details', attr: 'href'},
        price: {sel: '.priceInfos .price b'},
        condition: {sel: '.advertType .priceInfos .typeUsed b'},
        description: {sel: '.sellerComment'},
        vendor: {sel: '.sellerName'},
        vendor_rating: {sel: '.sellerRating .value'},
        vendor_ratings: {sel: '.sellerRating .sales'}
      });
    }
    done(null, output);
  })
  .result(function(err, req, res) {
    if (err) {
      req.retryNow();
    } else {
      // Stack next search page
      if (res.data.nextPage)
        this.addUrl(res.data.nextPage);           
      // Stack items pages from search results
      if (res.data.items)
        res.data.items.forEach(function(item){
          item.url = item.url.replace(/^(http.*?\.com)?\//, 'http://www.priceminister.com/');
        // TODO Add cache via read data
          this.addUrl({
            url: item.url,
            data: {
              meta: item
            }
          });
          item.url = item.url.replace(/#.*$/, '');
        }, this);
      // Collect announces from item page
      if (res.data.announces) {
        results = results.concat(res.data.announces.map(function(a){
          a.title = req.data.meta.title;
          a.img = req.data.meta.img;
          a.url = a.url.replace(/^(http.*?\.com)?\//, 'http://www.priceminister.com/');
          a.id = parseInt(a.url.replace(/^.*&productid=(\d+)\D*.*$/, '$1'));
          a.urlsource = req.data.meta.url + '#pid=' + a.id;
          a.price = parseFloat(a.price.replace(/[^\d,]/g, '').replace(',', '.'));
          a.vendor_rating = parseFloat(a.vendor_rating.replace(/\/5/, '').replace(',', '.'));
          a.vendor_ratings = parseInt(a.vendor_ratings.replace(/\D/g, ''));
          return a;
        }));
        jf.writeFile('data.json', results);
      }
    }
  })
  .run(function(err, remains) {
    //jf.writeFile('data.json', results);
  });