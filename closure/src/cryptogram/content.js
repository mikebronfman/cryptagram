goog.provide('cryptogram.content');

goog.require('goog.Uri');
goog.require('goog.dom');
goog.require('goog.ui.Dialog');

goog.require('cryptogram');
goog.require('cryptogram.demo');
goog.require('cryptogram.storage');
goog.require('cryptogram.media.generic');
goog.require('cryptogram.media.facebook');
goog.require('cryptogram.media.googleplus');


var content_;


/**
 * @constructor
 */
cryptogram.content = function() {
  
  var URL = new goog.Uri(window.location);
  var knownMedia = [cryptogram.media.facebook,
                    cryptogram.media.googleplus,
                    cryptogram.media.generic];
  var testMedia;
  for (var i = 0; i < knownMedia.length; i++) {
    testMedia = new knownMedia[i](URL);
    if (testMedia.matchesURL()) {
      this.media = testMedia;
      break;
    }
  }
  
  this.lastAutoDecrypt = '';
  this.storage = new cryptogram.storage(this.media);
  var self = this;
      
  chrome.extension.onRequest.addListener(function(request, sender, callback) {
    self.handleRequest(request, sender, callback);
  });
};




cryptogram.content.prototype.handleRequest = function(request, sender, callback) {
  
  var self = this;
  var password = null;
  this.callback = callback;

  if (request['storage']) {
    this.storage.load(request['storage']);
  }

  if (request['showEncoder']) {
     console.log("Encoder");
          

    var dialog1 = new goog.ui.Dialog();
    dialog1.setContent('<img src="http://images.icanhascheezburger.com/' +
        'completestore/2009/3/25/128825075025577352.jpg" ' +
        'width="400" height="255"><br>' +
        'Lorem ipsum dolor sit amet, consectetuer' +
        'adipiscing elit. Aenean sollicitudin ultrices urna. Proin vehicula ' +
        'mauris ac est. Ut scelerisque, risus ut facilisis dictum, est massa ' +
        'lacinia lorem, in fermentum purus ligula quis nunc. Duis porttitor ' +
        'euismod risus. Nam hendrerit lacus vehicula augue. Duis ante.');
    dialog1.setTitle('My favorite LOLCat');
    dialog1.setButtonSet(goog.ui.Dialog.ButtonSet.CONTINUE_SAVE_CANCEL);
    goog.events.listen(dialog1, goog.ui.Dialog.EventType.SELECT, function(e) {
      alert('You chose: ' + e.key);
    });

    dialog1.setVisible(true);

//      var demo = new cryptogram.demo();
//      demo.showEncrypt();
      }

  if (request['autoDecrypt']) {
      
    if (request['autoDecrypt'] == this.lastAutoDecrypt) {
      cryptogram.log("Ignoring redundant autodecrypt request.");
      return;
    }
    cryptogram.log("Autodecrypting:", request['autoDecrypt']);
    this.lastAutoDecrypt = request['autoDecrypt'];
    this.media.onReady(function() {
      self.autoDecrypt(request['autoDecrypt']);
    });
  }

  if (request['decryptURL']) {
    var URL = request['decryptURL'];
    if (URL.search('data:') == 0) {
      this.container.revertSrc();
      return;
    }
  
    this.photoId = this.media.getPhotoName(URL);
    this.albumId = this.media.getAlbumName(URL);
    password = this.storage.getPasswordForURL((URL));

    if (!password) {
      password = prompt("Enter password for\n" + URL, "cryptogram");
    }
    if (!password) return;
    
    this.decryptByURL(request['decryptURL'], password);  
  }  
};


cryptogram.content.prototype.setStatus = function(message) {
  this.media.setStatus(message);
};


cryptogram.content.prototype.decryptImage = function(image, password) {

 if (this.container) {
    this.container.remove();
    this.container = null;
  }
  this.container = new cryptogram.container(image);
  var self = this;
  var loader = new cryptogram.loader(this.container);
   
  var fullURL = this.media.fixURL(image.src);
  if (!fullURL) return;
  loader.getImageData(fullURL, function(data) {
    var decoder = new cryptogram.decoder(self.container);
    decoder.decodeData(data, password, function(result) {
      if (result) {
        self.container.setSrc(result);
      }
    });
  });
};


cryptogram.content.prototype.decryptByURL = function(URL, password) {
  
  cryptogram.log("Request to decrypt:", URL);
    
  if (this.container) {
    this.container.remove();
    this.container = null;
  }
  this.container = this.media.loadContainer(URL);
  var loader = new cryptogram.loader(this.container);
  var fullURL = this.media.fixURL(URL);
  
  var self = this;

  loader.getImageData(fullURL, function(data) {
    var decoder = new cryptogram.decoder(self.container);
    decoder.decodeData(data, password, function(result) {
      
      if (result) {
        self.container.setSrc(result);
        self.callback({'outcome': 'success', 'id' : self.photoId, 'password' : password, 'album' : self.albumId});
      }
    });
  });
};


cryptogram.content.prototype.autoDecrypt = function() {
      
  var images = this.media.getImages();
  
  if (images) {
    cryptogram.log("Checking "+ images.length +" images against saved passwords.");
  }
  
  for (var i = 0; i < images.length; i++) {
    var password = this.storage.getPasswordForURL(images[i].src);
    if (password) {
      this.decryptImage(images[i], password);
    }
  }
};


content_ = new cryptogram.content();