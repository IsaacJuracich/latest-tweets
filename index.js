var request = require('request');
var xpath = require('xpath');
var dom = require('xmldom').DOMParser;
var unescape = require('unescape');

module.exports = function (username, skipPinnedTweets, cb) {
  var url = 'https://twitter.com/' + username;

  // oh yeah //extreme fragility//
  if (process.browser) {
    url = 'http://cors.io/?' + url;
  }

  request(url, function (err, res, body) {
    if (err) {
      cb(err);
    } else {
      var res = [];

      var doc = new dom({ errorHandler: function () {} }).parseFromString(body);
      if (skipPinnedTweets) {
        var tweets = xpath.select(
          "//li[contains(@class, 'js-stream-item') and not(contains(@class,'js-pinned'))]",
          doc
        );
      } else {
        var tweets = xpath.select(
          "//li[contains(@class, 'js-stream-item')]",
          doc
        );
      }
      tweets.forEach(function (n) {
        var tweet = xpath.select(
          "./div[contains(@class, 'tweet')]/div[contains(@class, 'content')]",
          n
        )[0];
        if (!tweet) {
          // bad tweet?
          return;
        }
        let mentions = [];
        let hashtags = [];
        let links = [];
        var header = xpath.select(
          "./div[contains(@class, 'stream-item-header')]",
          tweet
        )[0];
        var body = xpath.select(
          "*/p[contains(@class, 'tweet-text')]/text()",
          tweet
        )[0];
        var fullname = xpath.select(
          './/strong[contains(@class, "fullname")]/text()',
          header
        )[0];
        if (body) body = nodeToText(body);
        var imageContainer = xpath.select(
          ".//div[contains(@class, 'js-adaptive-photo')]/@data-image-url",
          tweet
        )[0];
        var img = imageContainer ? imageContainer.value : null;
        if (body) {
          mentions = (body.match(/\s([@][\w_-]+)/gi) || []).map(str =>
            str.trim()
          );
          hashtags = (body.match(/\s([#][\w_-]+)/gi) || []).map(str =>
            str.trim()
          );
          links = (
            body.match(
              /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9]\.[^\s]{2,})/g
            ) || []
          ).map(str => str.trim());
        }
        var item = {
          username:
            '@' +
            xpath.select(
              "./a/span[contains(@class, 'username')]/b/text()",
              header
            )[0].data,
          body: body,
          fullname: fullname ? fullname.data : '',
          avatar: xpath.select(
            './a/img[contains(@class, "avatar")]/@src',
            header
          )[0].value,
          url:
            'https://twitter.com' +
            xpath.select(
              './small[contains(@class, "time")]/a[contains(@class, "tweet-timestamp")]/@href',
              header
            )[0].value,
          image: img,
          timestamp: xpath.select(
            './small[contains(@class, "time")]/a[contains(@class, "tweet-timestamp")]/span/@data-time',
            header
          )[0].value,
          mentions: mentions,
          hashtags: hashtags,
          links: links,
        };

        var date = new Date(1970, 0, 1);
        date.setSeconds(item.timestamp);
        item.timestamp = date.toISOString();

        res.push({
          username: item.username,
          fullname: item.fullname,
          retweet: item.username.toLowerCase() !== '@' + username.toLowerCase(),
          url: item.url,
          image: item.image,
          content: item.body,
          date: date,
          mentions: item.mentions,
          hashtags: item.hashtags,
          links: item.links,
        });
      });

      cb(null, res);
    }
  });
};

function unescapeHarder(txt) {
  return unescape(txt)
    .replace('&nbsp;', ' ')
    .replace('…', '')
    .replace('\\n', ' ')
    .replace('http', ' http');
}

function nodeToText(node) {
  if (!node) {
    return '';
  }
  return (
    unescapeHarder(node.nodeValue || '') +
    nodeToText(node.firstChild) +
    nodeToText(node.nextSibling)
  );
}
