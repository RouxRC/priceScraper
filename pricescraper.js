var jf = require('jsonfile'),
  sandcrawler = require('sandcrawler'),
  logger = require('sandcrawler-logger'),
  dashboard = require('sandcrawler-dashboard'),
  absUrl = function(u){
    return u.replace(/^(http.*?\.com)?\//, 'http://www.priceminister.com/');
  },
  logConf = {
    level: 'verbose',
    pageLog: false
  },
  results = [],
  doneItemUrls = {};
jf.spaces = 2;

var droid = sandcrawler.phantomDroid()
  //.use(logger(logConf))
  .use(dashboard({logger: logConf}))
  .config({
    timeout: 30000,
    maxRetries: 5
  })
  .throttle(250, 1000)
  .url('http://www.priceminister.com/s/megadrive?nav=Jeux-Video-et-Consoles_Jeux-Video')
  .scraper(function($, done) {
    var output = {};

    // Scrape items from search pages
    output.items = $('.productNav.photoSize_MML .product').scrape({
      name: {sel: 'h3.productName'},
      url: {sel: 'a.productLnk', attr: 'href'},
      img: {sel: '.productPhoto img.photo', attr: 'src'}
    });
    output.nextPage = $('.pmbt.btn.next').attr('href');

    // Click on display more announces if present
    var wait = 0;
    if ($('.btn.moreResults').length) {
      $('.btn.moreResults').click();
      wait = 1000;
    }
    setTimeout(function(){
    // Scrape announces from item's page
      output.announces = $('#advert_list tbody tr').filter(function(){
        return $(this).find('.advertPrice').length;
      }).scrape({
        url: {sel: '.see_details', attr: 'href'},
        price: {sel: '.priceInfos .price b'},
        condition: {sel: '.advertType .priceInfos li b'},
        description: {sel: '.sellerComment'},
        vendor: {sel: '.sellerName'},
        vendor_rating: {sel: '.sellerRating .value'},
        vendor_ratings: {sel: '.sellerRating .sales'}
      });
  
      done(null, output);
    }, wait);
  })
  .result(function(err, req, res) {
    if (err)
      return req.retryNow();

    // Stack items pages from search results
    if (res.data.items.length)
      res.data.items.forEach(function(item){
        item.url = absUrl(item.url).replace(/#.*$/, '');
        if (item.url in doneItemUrls)
          this.logger.info('Skipping already scraped item ' + item.name)
        else this.addUrl({
          url: item.url,
          data: {
            sourceurl: req.url,
            item: item,
          }
        });
      }, this);

    // Stack next search page
    if (res.data.nextPage)
      this.addUrl(absUrl(res.data.nextPage));           

    // Collect announces from item page
    if (res.data.announces.length) {
      doneItemUrls[req.url] = true;
      this.logger.info(res.data.announces.length + ' announces for ' + req.data.item.name);
      results = results.concat(res.data.announces.map(function(a){
        a.name = req.data.item.name;
        a.img = req.data.item.img;
        a.url = absUrl(a.url)
        a.id = parseInt(a.url.replace(/^.*&productid=(\d+)\D*.*$/, '$1'));
        a.urlsource = req.url + '#pid=' + a.id;
        a.price = parseFloat(a.price.replace(/[^\d,]/g, '').replace(',', '.'));
        a.condition = a.condition.replace(/\n+/g, ' ').trim();
        a.description = a.description.replace(/\n+/g, ' ').replace('Commentaire : ', '').trim();
        a.vendor_rating = parseFloat(a.vendor_rating.replace(/\/5/, '').replace(',', '.'));
        a.vendor_ratings = parseInt(a.vendor_ratings.replace(/\D/g, ''));
        return a;
      }));
      jf.writeFile('data.json', results);
    }
  });

// Do not redo already saved items urls
jf.readFile('data.json', function(err, data){
  if (data) {
    results = data;
    data.forEach(function(a){
      doneItemUrls[a.urlsource.replace(/#.*$/, '')] = true;
    });
    droid.logger.info('Starting scraping with already ' + Object.keys(doneItemUrls).length + ' items processed');
  }
  droid.run(function(err, remains) {
    // TODO Write CSV + errors
    //jf.writeFile('data.json', results);
  });
});
