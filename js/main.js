/**
 * MSOutlookit - Reddit client styled as Microsoft Outlook
 * Refactored for maintainability and readability
 */

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const CONFIG = {
  REDDIT_DOMAIN: 'https://msoutlookit.n3evin.workers.dev',
  RANDOM_USER_API: 'https://randomuser.me/api/?results=1000',
  WINDOW: {
    MIN_HEIGHT: 320,
    MIN_WIDTH: 673,
    SPAWN_OFFSET: 50,
    INITIAL_SPAWN_EDGE: 100,
    WINDOW_OFFSET: 200,
    Z_INDEX_BASE: 50,
    Z_INDEX_FRONT: 51
  },
  LAYOUT: {
    BACKGRADIENT_OFFSET: 139,
    MAINROW_OFFSET: 166,
    PREVIEWAREA_OFFSET: 216,
    EMAILBODY_OFFSET: 181,
    RIGHT_WIDTH_OFFSET: 640,
    MINHOLDER_OFFSET: 350,
    FOLDERHOLDER_OFFSET: 400,
    TASKBAR_MULTIPLIER: 60
  },
  SCROLL: {
    BUFFER_VALUE: 80,
    RESIZE_DELAY: 10
  },
  NSFW: {
    MARKER: '<b><font style="color:red"> ✔</font></b>'
  }
};

const FALLBACK_NAMES = [
  'Rick Deckard', 'James Bond', 'Korben Dallas', 'Danny Ocean',
  'Cha Tae-sik', 'Homer Hickam', 'Ben Wade', 'Jon Osterman',
  'Vincent Freeman', 'Llewelyn Moss', 'Richard Winters', 'Lewis Nixon',
  'George Luz', 'Lynn Compton', 'Ronald Speirs', 'Anton Chigurh',
  'Irene Cassini', 'Sam Bell', 'Gerty', 'Edward Blake',
  'Dan Evans', 'Charlie Prince', 'Quentin', 'Jeong So-mi',
  'Bryan Mills', 'Rusty Ryan', 'Linus Caldwell',
  'Jean-Baptiste Emanuel Zorg', 'Father Vito Cornelius', 'Ruby Rhod',
  'Chief John Anderton'
];

const DEFAULT_SUBREDDITS = [
  'gaming', 'pics', 'askreddit', 'jokes', 'funny', 'iama', 'wtf'
];

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const AppState = {
  noTaskbar: 0,
  alwaysHideNSFW: true,
  randomNames: [],
  idList: [],
  globalStoryDict: {},
  globalWindowDict: {},
  globalFolderDict: {},
  globalScrollDict: {},
  infiniteScrollLoading: false,
  currentStory: null,
  currentFolder: null,
  tempFolderName: null,
  spawnEdge: CONFIG.WINDOW.INITIAL_SPAWN_EDGE,
  firstTime: true
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generates a unique ID that doesn't exist in idList
 * @returns {number} Unique ID
 */
function generateUid() {
  const uid = Math.floor(Math.random() * 100000) + 1;
  if (AppState.idList.indexOf(uid) > -1) {
    return generateUid();
  }
  AppState.idList.push(uid);
  return uid;
}

/**
 * Gets a random name from available names (API or fallback)
 * @returns {string} Random name
 */
function getRandomName() {
  const namesArray = AppState.randomNames.length > 0 
    ? AppState.randomNames 
    : FALLBACK_NAMES;
  const randomIndex = Math.floor(Math.random() * namesArray.length);
  return namesArray[randomIndex];
}

/**
 * Initializes random names from API, falls back to default names on error
 */
async function initializeRandomNames() {
  try {
    const response = await fetch(CONFIG.RANDOM_USER_API);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    AppState.randomNames = data.results.map(user => 
      `${user.name.first} ${user.name.last}`
    );
  } catch (error) {
    console.error('Error fetching random names from API:', error);
    console.log('Using fallback names instead');
    AppState.randomNames = [...FALLBACK_NAMES];
  }
}

/**
 * Gets the Reddit API domain
 * @returns {string} Reddit domain URL
 */
function getRedditDomain() {
  return CONFIG.REDDIT_DOMAIN;
}

/**
 * Fetches JSON from a URL with error handling
 * @param {string} url - URL to fetch
 * @param {Function} callback - Success callback
 * @param {Function} errorCallback - Error callback
 */
function fetchJson(url, callback, errorCallback) {
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(callback)
    .catch(error => {
      console.error('Error fetching JSON:', error);
      if (errorCallback) {
        errorCallback(error);
      }
    });
}

// ============================================================================
// HTML TEMPLATE HELPERS
// ============================================================================

/**
 * Creates email window HTML template
 * @param {Object} params - Window parameters
 * @returns {string} HTML string
 */
function createEmailWindowHTML(params) {
  const {
    id, tofield, ccfield, subjectfield, bodyfield, 
    isLogin, tabindexBase
  } = params;
  
  const fieldType = isLogin ? 'password' : 'text';
  
  return `
    <div id="${id}" class="emailwindow" style="position:absolute;left:100px;top:300px;">
      <div class="minimize"></div>
      <div class="maximize"></div>
      <div class="windowclose"></div>
      <div class="upperleftemailwindow"></div>
      <div class="emailwindowbanner"></div>
      <div class="emailbuttons"></div>
      <div class="emailbuttonsbanner"></div>
      <div class="emailcomposewindow">
        <input type="button" value="Send" class="sendbutton" tabindex="${tabindexBase + 5}">
        <div class="emailcomposebuttons"></div>
        <input type="text" rows="1" cols="40" class="afield tofield" 
               tabindex="${tabindexBase + 1}" value="${tofield}">
        <input type="${fieldType}" rows="1" cols="19" class="afield ccfield" 
               tabindex="${tabindexBase + 2}" value="${ccfield}">
        <input type="text" rows="1" cols="19" tabindex="${tabindexBase + 3}" 
               class="afield subjectfield" value="${subjectfield}">
        <textarea tabindex="${tabindexBase + 4}" class="emailcomposebody">${bodyfield}</textarea>
      </div>
    </div>
  `;
}

/**
 * Creates email preview HTML
 * @param {Object} params - Preview parameters
 * @returns {string} HTML string
 */
function createEmailPreviewHTML(params) {
  const { id, randomName, author, score, title, subreddit, domain } = params;
  
  return `
    <div id="${id}" class="anemail emailunread">
      <div class="emailicon"></div>
      <div class="emailiconright"></div>
      <div class="emailpreview">
        <div class="emailname">${randomName} (${author})</div>
        <div class="emailtitle">
          (RE:^${score})  ${title} 
          <br />
          <span style="color: #3498DB">${subreddit} | ${domain}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Creates minimized window HTML
 * @param {string} id - Window ID
 * @returns {string} HTML string
 */
function createMinimizedWindowHTML(id) {
  return `<div id="m${id}" class="emailmin emailminhigh"></div>`;
}

// ============================================================================
// DATA MODELS
// ============================================================================

/**
 * Folder model for storing subreddit data
 */
function Folder() {
  this.after = '';
  this.count = 0;
  this.emailDict = {};
  this.subredditname = '';
  this.strippedID = '';
}

/**
 * Story model for Reddit posts
 * @param {Object} parentJson - Reddit JSON data
 * @param {Folder} folder - Parent folder
 * @param {boolean} addToDom - Whether to add to DOM immediately
 */
function Story(parentJson, folder, addToDom) {
  const rootJson = parentJson.data;
  this.rootJson = rootJson;
  this.folder = folder;
  this.id = rootJson.name;
  this.title = rootJson.title;
  
  // Add NSFW marker if needed
  if (rootJson.over_18 && AppState.alwaysHideNSFW) {
    this.title += CONFIG.NSFW.MARKER;
  }
  
  // Create preview HTML
  const randomName = getRandomName();
  this.previewHTML = createEmailPreviewHTML({
    id: this.id,
    randomName: randomName,
    author: rootJson.author,
    score: rootJson.score,
    title: this.title,
    subreddit: rootJson.subreddit,
    domain: rootJson.domain
  });
  
  this.bodyHTML = '';
  
  // Register in dictionaries
  folder.emailDict[this.id] = this;
  AppState.globalStoryDict[this.id] = this;
  
  if (addToDom) {
    $('#previewarea').append(this.previewHTML);
  }
  
  this.addToArea = function() {
    $('#previewarea').append(this.previewHTML);
  };
}

/**
 * Window model for email compose windows
 * @param {string} type - Window type
 * @param {string} state - Window state
 * @param {string} tofield - To field value
 * @param {string} ccfield - CC field value
 * @param {string} subjectfield - Subject field value
 * @param {string} bodyfield - Body field value
 * @param {boolean} isLogin - Whether this is a login window
 */
function EmailWindow(type, state, tofield, ccfield, subjectfield, bodyfield, isLogin) {
  this.type = type;
  this.state = state;
  this.id = String(generateUid());
  this.tofield = tofield;
  this.ccfield = ccfield;
  this.subjectfield = subjectfield;
  this.bodyfield = bodyfield;
  this.idfinder = `#${this.id}`;
  this.minfinder = `#m${this.id}`;
  this.isMaxed = false;
  this.oldHeight = null;
  this.oldWidth = null;
  this.oldLeft = null;
  this.oldTop = null;
  
  AppState.globalWindowDict[this.id] = this;
  
  this._initializeWindow();
  this._setupEventHandlers();
  this._setupWindowMethods();
}

EmailWindow.prototype._initializeWindow = function() {
  // Create and append window HTML
  const tabindexBase = Math.floor(Math.random() * 1000);
  const html = createEmailWindowHTML({
    id: this.id,
    tofield: this.tofield,
    ccfield: this.ccfield,
    subjectfield: this.subjectfield,
    bodyfield: this.bodyfield,
    isLogin: false, // Will be set if needed
    tabindexBase: tabindexBase
  });
  
  $('.outlookminhi').removeClass('outlookminhi');
  $('body').append(html);
  
  // Position window
  $(this.idfinder).css({
    left: AppState.spawnEdge,
    top: AppState.spawnEdge
  });
  
  // Update spawn edge for next window
  AppState.spawnEdge += CONFIG.WINDOW.SPAWN_OFFSET;
  if (AppState.spawnEdge > $(window).height() - CONFIG.WINDOW.WINDOW_OFFSET) {
    AppState.spawnEdge = CONFIG.WINDOW.SPAWN_OFFSET;
  }
  
  // Focus appropriate field
  const toFieldElement = $(this.idfinder).children('.emailcomposewindow').children('.tofield');
  if (this.tofield.substr(0, 5) === 'reply') {
    $(this.idfinder).children('.emailcomposewindow').children('.emailcomposebody').focus();
  } else {
    toFieldElement.focus();
  }
  
  // Create minimized window
  const minHTML = createMinimizedWindowHTML(this.id);
  $('.emailminhigh').removeClass('emailminhigh');
  $('.minholder').append(minHTML);
  
  // Setup resize function
  this._setupResizeFunction();
  
  // Make draggable and resizable
  $(this.idfinder).draggable({ containment: 'window' });
  $(this.idfinder).resizable({
    minHeight: CONFIG.WINDOW.MIN_HEIGHT,
    minWidth: CONFIG.WINDOW.MIN_WIDTH,
    resize: this.resizeFunc
  });
};

EmailWindow.prototype._setupResizeFunction = function() {
  const scopeidfinder = this.idfinder;
  this.resizeFunc = function() {
    const $window = $(scopeidfinder);
    const $composeWindow = $window.children('.emailcomposewindow');
    const windowHeight = $window.height();
    const windowWidth = $window.width();
    
    $composeWindow.height(windowHeight - 152);
    const composeHeight = $composeWindow.height();
    const composeWidth = $composeWindow.width();
    
    $composeWindow.children('.emailcomposebody')
      .height(composeHeight - 112)
      .width(composeWidth - 34);
    
    $composeWindow.children('.afield').width(composeWidth - 133);
  };
  this.resizeFunc();
};

EmailWindow.prototype._setupEventHandlers = function() {
  const self = this;
  
  // Send button click
  $(this.idfinder).children('.emailcomposewindow').children('.sendbutton').click(function() {
    // Handler can be extended here
  });
  
  // Minimized window click
  $(this.minfinder).click(function() {
    const minid = $(this).attr('id');
    const id = minid.substr(1);
    if ($(this).hasClass('emailminhigh')) {
      $(`#${id}`).css('display', 'none');
      $(`#${minid}`).removeClass('emailminhigh');
    } else {
      AppState.globalWindowDict[id].bringToFront();
    }
  });
  
  // Window mousedown
  $(this.idfinder).mousedown(function() {
    AppState.globalWindowDict[$(this).attr('id')].bringToFront();
  });
  
  // Window controls
  $(this.idfinder).children('.minimize').click(function() {
    AppState.globalWindowDict[$(this).parent().attr('id')].minimize();
  });
  
  $(this.idfinder).children('.windowclose').click(function() {
    AppState.globalWindowDict[$(this).parent().attr('id')].close();
  });
  
  $(this.idfinder).children('.maximize').click(function() {
    AppState.globalWindowDict[$(this).parent().attr('id')].maximize();
  });
};

EmailWindow.prototype._setupWindowMethods = function() {
  const self = this;
  
  this.bringToFront = function() {
    $('.outlookminhi').removeClass('outlookminhi');
    $('.emailwindow').css('z-index', CONFIG.WINDOW.Z_INDEX_BASE);
    $(self.idfinder).css('z-index', CONFIG.WINDOW.Z_INDEX_FRONT);
    $(self.idfinder).css('display', 'block');
    $('.emailminhigh').removeClass('emailminhigh');
    $(self.minfinder).addClass('emailminhigh');
  };
  
  this.minimize = function() {
    $(self.minfinder).removeClass('emailminhigh');
    $(self.idfinder).css('display', 'none');
  };
  
  this.close = function() {
    delete AppState.globalWindowDict[self.id];
    $(self.minfinder).css('display', 'none');
    $(self.idfinder).css('display', 'none');
    AppState.spawnEdge = CONFIG.WINDOW.INITIAL_SPAWN_EDGE;
  };
  
  this.maximize = function() {
    $('.outlookminhi').removeClass('outlookminhi');
    
    if (!self.isMaxed) {
      self.bringToFront();
      const width = $(window).width();
      const height = $(window).height() - 55;
      
      // Save current dimensions
      self.oldWidth = $(self.idfinder).css('width');
      self.oldHeight = $(self.idfinder).css('height');
      self.oldLeft = $(self.idfinder).css('left');
      self.oldTop = $(self.idfinder).css('top');
      
      // Maximize
      $(self.idfinder).css({
        width: `${width}px`,
        height: `${height}px`,
        position: 'absolute',
        top: '0px',
        left: '0px'
      });
      
      $(self.idfinder).draggable('disable');
      self.resizeFunc();
      self.isMaxed = true;
    } else {
      // Restore
      self.bringToFront();
      $(self.idfinder).css({
        width: self.oldWidth,
        height: self.oldHeight,
        left: self.oldLeft,
        top: self.oldTop
      });
      
      self.resizeFunc();
      $(self.idfinder).draggable('enable');
      self.isMaxed = false;
    }
  };
};

// ============================================================================
// REDDIT API FUNCTIONS
// ============================================================================

/**
 * Populates story with comments and content
 * @param {string} id - Story ID
 * @returns {boolean} Whether story was populated
 */
function populateStory(id) {
  const story = AppState.globalStoryDict[id];
  AppState.currentStory = id;
  
  if (!story) {
    return false;
  }
  
  if (story.bodyHTML.length > 1) {
    return false;
  }
  
  $('div.theemailbody').html('<img src="images/loading.gif">');
  const storyName = id.substr(3);
  const link = `${getRedditDomain()}/comments/${storyName}.json`;
  
  fetchJson(link, commentsCallback, function(error) {
    $('div.theemailbody').html('Error loading comments. Please try again.');
  });
  
  return true;
}

/**
 * Callback for processing Reddit comments JSON
 * @param {Array} storyJSON - Reddit JSON response
 */
function commentsCallback(storyJSON) {
  const mainJSON = storyJSON[0].data.children[0].data;
  const theStoryID = mainJSON.name;
  const story = AppState.globalStoryDict[theStoryID];
  
  if (!story) return;
  
  // Add story content
  if (isImgur(mainJSON.url)) {
    const expando = makeImgurExpando(mainJSON.url, mainJSON.title);
    story.bodyHTML += expando;
  } else {
    story.bodyHTML += `<a href="${mainJSON.url}">${mainJSON.title}</a><br/>`;
    if (mainJSON.selftext_html) {
      story.bodyHTML += mainJSON.selftext_html;
    }
  }
  
  // Handle self posts
  if (mainJSON.isSelf && mainJSON.selftext_html) {
    story.bodyHTML += mainJSON.selftext_html;
  }
  
  // Decode HTML entities and process embeds
  story.bodyHTML = unEncode(story.bodyHTML);
  story.bodyHTML += '<div class="storycommentline"></div>';
  
  // Process comments
  const commentsRoot = storyJSON[1].data.children;
  let commentsHTML = '';
  
  for (let i = 0; i < commentsRoot.length; i++) {
    if (commentsRoot[i].kind === 'more') {
      continue;
    }
    
    const commentJSON = commentsRoot[i].data;
    const author = commentJSON.author;
    const body_html = unEncode(commentJSON.body_html);
    const score = commentJSON.ups - commentJSON.downs;
    const id = commentJSON.name;
    
    commentsHTML += makeCommentHeader(score, author, body_html, id);
    commentsHTML += '<div class="childrencomments child0">';
    
    try {
      if (commentJSON.replies && commentJSON.replies.data) {
        commentsHTML += getChildComments(commentJSON.replies.data.children, 1);
      }
    } catch (err) {
      console.error('Error processing child comments:', err);
    }
    
    commentsHTML += '</div></div>';
  }
  
  story.bodyHTML += commentsHTML;
  
  // Update UI if this is the current story
  if (AppState.currentStory === theStoryID) {
    $('.theemailbody').html(story.bodyHTML);
  }
}

/**
 * Creates comment header HTML
 * @param {number} score - Comment score
 * @param {string} author - Comment author
 * @param {string} body_html - Comment body HTML
 * @param {string} id - Comment ID
 * @returns {string} HTML string
 */
function makeCommentHeader(score, author, body_html, id) {
  return `
    <div id="${id}" class="commentroot">
      <div class="authorandstuff showhover">
        <span class="score">${score}</span> 
        <span class="commentauthor">${author}</span>
      </div>
      <div class="commentbody">${body_html}</div>
  `;
}

/**
 * Recursively processes child comments
 * @param {Array} jsonroot - Comments array
 * @param {number} level - Nesting level
 * @returns {string} HTML string
 */
function getChildComments(jsonroot, level) {
  if (!jsonroot) {
    return '';
  }
  
  let tempHTML = '';
  
  for (let i = 0; i < jsonroot.length; i++) {
    if (jsonroot[i].kind === 'more') {
      continue;
    }
    
    const commentjson = jsonroot[i].data;
    const author = commentjson.author;
    const body_html = unEncode(commentjson.body_html);
    const score = commentjson.ups - commentjson.downs;
    const id = commentjson.name;
    
    tempHTML += makeCommentHeader(score, author, body_html, id);
    tempHTML += `<div class="childrencomments child${level}">`;
    
    try {
      if (commentjson.replies && commentjson.replies.data) {
        tempHTML += getChildComments(commentjson.replies.data.children, level + 1);
      }
    } catch (err) {
      console.error('Error processing nested comments:', err);
    }
    
    tempHTML += '</div></div>';
  }
  
  return tempHTML;
}

// ============================================================================
// CONTENT PROCESSING
// ============================================================================

/**
 * Decodes HTML entities and processes embeds (images, videos, links)
 * @param {string} text - HTML text to process
 * @returns {string} Processed HTML
 */
function unEncode(text) {
  if (!text) return '';
  
  // Basic HTML entity decoding
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/\n/g, '<br/>');
  text = text.replace(/&#3232;/g, '?');
  text = text.replace(/&amp;/gi, '&');
  
  // Process direct image links
  text = processImageLinks(text);
  
  // Process Imgur links
  text = processImgurLinks(text);
  
  // Process YouTube links
  text = processYouTubeLinks(text);
  
  // Process other external links
  text = processExternalLinks(text);
  
  return text;
}

/**
 * Processes direct image links
 */
function processImageLinks(text) {
  const imageRegex = /<a href="(http:.*?\.(jpg|jpeg|png|gif|JPEG|GIF|PNG))".*?>(.*?)<\/a>/gi;
  let results = imageRegex.exec(text);
  
  while (results !== null) {
    const complete = results[0];
    const url = results[1];
    const title = results[3];
    const tempHTML = makeImgurExpando(url, title);
    text = text.replace(complete, tempHTML);
    results = imageRegex.exec(text.substr(text.indexOf(tempHTML) + tempHTML.length));
  }
  
  return text;
}

/**
 * Processes Imgur links
 */
function processImgurLinks(text) {
  const imgurRegex = /<a.*?href="(http:\/\/imgur.com\/(\w+))".*?>(.*?)<\/a>/g;
  let results = imgurRegex.exec(text);
  
  while (results !== null) {
    for (let i = 0; i < results.length; i += 4) {
      const complete = results[i];
      let url = results[i + 1];
      const code = results[i + 2];
      const title = results[i + 3];
      
      if (url.toLowerCase().indexOf('.gifv') > -1) {
        url = `http://i.imgur.com/${code}`;
      } else {
        url = `http://i.imgur.com/${code}.jpg`;
      }
      
      const tempHTML = makeImgurExpando(url, title);
      text = text.replace(complete, tempHTML);
    }
    results = imgurRegex.exec(text);
  }
  
  return text;
}

/**
 * Processes YouTube links
 */
function processYouTubeLinks(text) {
  const youtubeRegex1 = /<a.*?href="(http:.*?youtube.com.*?v=([-\w]+)).*?".*?>(.*?)<\/a>/gi;
  const youtubeRegex2 = /<a.*?href="(http:.*?youtu\.be\/([-\w]+)).*?".*?>(.*?)<\/a>/gi;
  
  let results = youtubeRegex1.exec(text);
  if (results === null) {
    results = youtubeRegex2.exec(text);
  }
  
  while (results !== null) {
    const complete = results[0];
    const url = results[1];
    const code = results[2];
    const title = results[3];
    const tempHTML = makeYoutubeExpando(url, title);
    text = text.replace(complete, tempHTML);
    
    results = youtubeRegex1.exec(text);
    if (results === null) {
      results = youtubeRegex2.exec(text);
    }
  }
  
  return text;
}

/**
 * Processes external links (non-YouTube, non-Reddit)
 */
function processExternalLinks(text) {
  const linkRegex = /<a href="(http:.*?)".*?>(.*?)<\/a>/gi;
  const results = linkRegex.exec(text);
  
  if (results !== null) {
    if (results[0].indexOf('youtube.com') === -1 && 
        results[0].indexOf('reddit.com') === -1) {
      const complete = results[0];
      const url = results[1];
      const title = results[2];
      const tempHTML = getLynxdump(url, title);
      text = text.replace(complete, tempHTML);
    }
  }
  
  return text;
}

/**
 * Creates Imgur expando HTML
 * @param {string} externallink - Image URL
 * @param {string} title - Image title
 * @returns {string} HTML string
 */
function makeImgurExpando(externallink, title) {
  // Normalize Imgur URLs
  if (externallink.indexOf('i.imgur.com') === -1 && 
      externallink.indexOf('imgur.com') !== -1) {
    externallink = externallink.replace('imgur.com', 'i.imgur.com');
  }
  
  // Add extension if missing
  if (externallink.substr(-4, 1) !== '.' && 
      externallink.indexOf('.jpeg') === -1 && 
      externallink.indexOf('.gifv') === -1) {
    externallink += '.jpg';
    externallink = externallink.replace('?full', '');
  }
  
  const randId = String(Math.floor(Math.random() * 10000));
  let expando = `<div class="showhover expando" id="${randId}">+</div>`;
  
  if (externallink.indexOf('.gifv') >= 0) {
    externallink = externallink.replace('.gifv', '.mp4');
    expando += `<a href="javascript:void(0)" class="expando" id="${randId}">${title}</a>`;
    expando += `<div id="img${randId}" style="width:100%;display:none">`;
    expando += `<video class="normal" id="ig${randId}" class="expandoimg" style="width:100%;" autoplay loop>`;
    expando += `<source src="${externallink}" type="video/mp4"></video>`;
  } else {
    expando += `<a href="javascript:void(0)" class="expando" id="${randId}">${title}</a>`;
    expando += `<div id="img${randId}" style="width:100%;display:none">`;
    expando += `<img class="normal" id="ig${randId}" class="expandoimg" src="${externallink}" style="width:100%;" alt="redditlol"/>`;
  }
  
  expando += '</div>';
  return expando;
}

/**
 * Creates YouTube expando HTML
 * @param {string} externallink - YouTube URL
 * @param {string} title - Video title
 * @returns {string} HTML string
 */
function makeYoutubeExpando(externallink, title) {
  let normallink = /youtube\.com\/watch\?.*?v=([-\w]+)/ig.exec(externallink);
  if (normallink === null) {
    normallink = /youtu\.be\/([-\w]+)/ig.exec(externallink);
  }
  
  if (!normallink) return '';
  
  const videoid = normallink[1];
  let expando = `<div class="expando showhover" id="${videoid}">V</div>`;
  expando += `<a href="javascript:void(0)" class="expando" id="${videoid}">${title}</a>`;
  expando += `<div style="display:none" id="img${videoid}">`;
  expando += `<iframe id="${videoid}" width="560" height="349" src="http://www.youtube.com/embed/${videoid}" frameborder="0" allowfullscreen></iframe>`;
  expando += '</div>';
  return expando;
}

/**
 * Creates external link HTML
 * @param {string} externallink - External URL
 * @param {string} title - Link title
 * @returns {string} HTML string
 */
function getLynxdump(externallink, title) {
  const randId = String(Math.floor(Math.random() * 100000));
  return `<a id="lynxlink${randId}" href="${externallink}">${title}</a>`;
}

/**
 * Checks if URL is an image (Imgur or image file)
 * @param {string} externallink - URL to check
 * @returns {boolean} True if image
 */
function isImgur(externallink) {
  if (externallink.indexOf('imgur.com') !== -1) {
    return true;
  }
  
  const filetype = externallink.substr(-3, 3).toLowerCase();
  const imageTypes = ['png', 'peg', 'jpg', 'gif'];
  return imageTypes.includes(filetype);
}

// ============================================================================
// UI FUNCTIONS
// ============================================================================

/**
 * Handles infinite scroll for loading more posts
 */
function handleInfiniteScroll() {
  const container = document.getElementById('previewarea');
  if (!container) return;
  
  const maxScroll = container.scrollHeight - container.clientHeight;
  const currentScrollValue = container.scrollTop;
  const isScrolledToBottom = 
    (currentScrollValue + CONFIG.SCROLL.BUFFER_VALUE) >= maxScroll;
  
  if (isScrolledToBottom && !AppState.infiniteScrollLoading) {
    AppState.infiniteScrollLoading = true;
    loadMorePosts();
  }
}

/**
 * Handles expando click (image/video expansion)
 */
function expandoClick() {
  const tempid = $(this).attr('id');
  const finder = `#img${tempid}`;
  $(finder).toggle();
  
  const resizeFunc = function() {
    const wrapper = $(finder).children('.ui-wrapper');
    if (wrapper.length > 0) {
      const height = wrapper.height();
      const width = wrapper.width() - 10;
      const resizeHandle = wrapper.children('.ui-resizable-e');
      
      if (resizeHandle.length > 0) {
        resizeHandle.width(width);
        resizeHandle.height(height);
        resizeHandle.css('top', `-${height}px`);
      }
    }
  };
  
  const imgElement = $(finder).children('img.normal');
  if (imgElement.length > 0 && !imgElement.hasClass('ui-resizable')) {
    imgElement.resizable({
      aspectRatio: true,
      resize: resizeFunc
    });
    setTimeout(resizeFunc, CONFIG.SCROLL.RESIZE_DELAY);
  }
}

/**
 * Handles window resize
 */
function onResize() {
  const height = $(window).height();
  const width = $(window).width();
  const taskbarOffset = AppState.noTaskbar * CONFIG.LAYOUT.TASKBAR_MULTIPLIER;
  
  $('.backgradient').height(height - CONFIG.LAYOUT.BACKGRADIENT_OFFSET + taskbarOffset);
  $('.mainrow').height(height - CONFIG.LAYOUT.MAINROW_OFFSET + taskbarOffset);
  $('#previewarea').height(height - CONFIG.LAYOUT.PREVIEWAREA_OFFSET + taskbarOffset);
  $('.theemailbody').height(height - CONFIG.LAYOUT.EMAILBODY_OFFSET + taskbarOffset);
  $('.right').width(width - CONFIG.LAYOUT.RIGHT_WIDTH_OFFSET + taskbarOffset);
  $('.minholder').width(width - CONFIG.LAYOUT.MINHOLDER_OFFSET + taskbarOffset);
  $('.folderholder').height(height - CONFIG.LAYOUT.FOLDERHOLDER_OFFSET + taskbarOffset);
}

/**
 * Reattaches click handlers to email items
 */
function onReload() {
  $('.anemail').off('click').on('click', emailClick);
}

/**
 * Shows popup notification
 * @param {string} message - Message to display
 */
function makePopup(message) {
  Swal.fire({
    title: message,
    icon: 'info',
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
  });
}

/**
 * Shows soft popup notification
 * @param {string} message - Message to display
 */
function makeSoftpopup(message) {
  Swal.fire({
    title: message,
    icon: 'info',
    toast: true,
    position: 'bottom-start',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
  });
}

// ============================================================================
// FOLDER MANAGEMENT
// ============================================================================

/**
 * Creates a folder for a subreddit
 * @param {string} name - Subreddit name
 * @param {boolean} custom - Whether it's a custom folder
 * @returns {Folder} Created folder
 */
function makeFolder(name, custom = false) {
  const strippedID = `folder_${name.replace(/\s/g, '')}`;
  const folder = new Folder();
  
  folder.strippedID = strippedID;
  folder.subredditname = name;
  
  AppState.globalFolderDict[strippedID] = folder;
  
  let folderClass = 'afolderwrapper';
  if (custom) {
    folderClass += ' customfolder';
  }
  
  const tempHTML = `
    <div class="${folderClass}">
      <div class="afolder" id="${strippedID}">${name}</div>
    </div>
  `;
  
  $('.foldwraphi').removeClass('foldwraphi');
  $('.folderholder').append(tempHTML);
  $(`#${strippedID}`).on('click', folderIconClick);
  
  return folder;
}

/**
 * Handles folder icon click
 */
function folderIconClick() {
  $('.foldwraphi').removeClass('foldwraphi');
  $(this).parent().addClass('foldwraphi');
  folderClick($(this).attr('id'));
}

/**
 * Handles folder click - loads subreddit content
 * @param {string} folderName - Folder ID
 */
function folderClick(folderName) {
  AppState.currentStory = null;
  AppState.currentFolder = AppState.globalFolderDict[folderName];
  
  if (!AppState.currentFolder) return;
  
  $('#previewarea').html('');
  
  if (!AppState.firstTime) {
    $('.theemailbody').html('');
    AppState.firstTime = false;
  }
  
  // Check if folder has content
  const hasContent = Object.keys(AppState.currentFolder.emailDict).length > 0;
  
  if (hasContent) {
    displayFolder(folderName);
  } else {
    loadFolderContent(folderName);
  }
}

/**
 * Loads folder content from Reddit API
 * @param {string} folderName - Folder ID
 */
function loadFolderContent(folderName) {
  $('.afolder').off('click');
  $('#previewarea').html('<img src="images/loading.gif"/>');
  
  const subredditname = folderName.substr(7); // Remove 'folder_' prefix
  let link = `${getRedditDomain()}/r/${subredditname}/new/.json`;
  
  if (subredditname === 'FrontPage') {
    link = `${getRedditDomain()}/r/all/.json`;
  }
  
  AppState.tempFolderName = folderName;
  
  fetchJson(link, folderCallback, function(error) {
    $('#previewarea').html('Error loading folder. Please try again.');
    $('.afolder').on('click', folderIconClick);
  });
}

/**
 * Callback for folder data fetch
 * @param {Object} data - Reddit JSON response
 */
function folderCallback(data) {
  $('.afolder').on('click', folderIconClick);
  
  const folder = AppState.globalFolderDict[AppState.tempFolderName];
  if (!folder) return;
  
  const after = data.data.after;
  folder.after = after;
  folder.count += 25;
  
  // Create stories from data
  for (let i = 0; i < data.data.children.length; i++) {
    new Story(data.data.children[i], folder, false);
  }
  
  displayFolder(AppState.tempFolderName);
}

/**
 * Displays folder content in preview area
 * @param {string} folderName - Folder ID
 */
function displayFolder(folderName) {
  const folder = AppState.globalFolderDict[folderName];
  
  if (AppState.currentFolder !== folder) {
    return;
  }
  
  $('#previewarea').html('');
  
  // Add all stories to preview area
  for (const key in folder.emailDict) {
    if (folder.emailDict.hasOwnProperty(key)) {
      folder.emailDict[key].addToArea();
    }
  }
  
  onReload();
  AppState.infiniteScrollLoading = false;
}

/**
 * Loads more posts (pagination)
 */
function loadMorePosts() {
  if (!AppState.currentFolder) return;
  
  $('.afolder').off('click');
  
  const folder = AppState.currentFolder;
  let link;
  
  if (folder.subredditname === 'Front Page') {
    link = `${getRedditDomain()}/new/.json?count=${folder.count}&after=${folder.after}`;
  } else {
    link = `${getRedditDomain()}/r/${folder.subredditname}/new/.json?count=${folder.count}&after=${folder.after}`;
  }
  
  fetchJson(link, folderCallback, function(error) {
    AppState.infiniteScrollLoading = false;
    $('.afolder').on('click', folderIconClick);
  });
}

/**
 * Refreshes current folder
 */
function refreshCurrentFolder() {
  if (!AppState.currentFolder) {
    return;
  }
  
  // Clear folder data
  AppState.currentFolder.emailDict = {};
  AppState.currentFolder.after = '';
  AppState.currentFolder.count = 0;
  
  // Clear UI
  $('#previewarea').html('');
  $('.theemailbody').html('');
  AppState.currentStory = null;
  
  // Reload folder
  folderClick(AppState.currentFolder.strippedID);
}

/**
 * Deletes current folder
 */
function deleteCurrentFolder() {
  if (!AppState.currentFolder) {
    return;
  }
  
  const folderId = AppState.currentFolder.strippedID;
  
  // Don't delete Front Page
  if (folderId === 'folder_FrontPage') {
    makePopup('Cannot delete Front Page');
    return;
  }
  
  // Remove from dictionary
  delete AppState.globalFolderDict[folderId];
  
  // Remove from DOM
  $(`#${folderId}`).parent().remove();
  
  // Switch to Front Page
  $('#folder_FrontPage').parent().addClass('foldwraphi');
  folderClick('folder_FrontPage');
}

/**
 * Adds a new subreddit folder
 */
function addSubReddit() {
  Swal.fire({
    title: 'Add Subreddit',
    text: 'Please enter a subreddit name',
    input: 'text',
    inputPlaceholder: 'Enter subreddit name',
    showCancelButton: true,
    confirmButtonText: 'Add',
    cancelButtonText: 'Cancel',
    inputValidator: (value) => {
      if (!value) {
        return 'You need to enter a subreddit name!';
      }
    }
  }).then((result) => {
    if (result.isConfirmed && result.value) {
      makeFolder(result.value, true);
    }
  });
}

// ============================================================================
// EMAIL HANDLERS
// ============================================================================

/**
 * Handles email click - displays story content
 */
function emailClick() {
  // Save scroll position for current story
  if (AppState.currentStory) {
    AppState.globalScrollDict[AppState.currentStory] = 
      $('.theemailbody').scrollTop();
  }
  
  const id = $(this).attr('id');
  
  // Try to populate story (loads if not already loaded)
  if (!populateStory(id)) {
    // Story already loaded, just display it
    const story = AppState.currentFolder.emailDict[id];
    if (story) {
      $('.theemailbody').html(story.bodyHTML);
      
      // Restore scroll position
      const savedScroll = AppState.globalScrollDict[AppState.currentStory];
      if (savedScroll !== null && savedScroll !== undefined) {
        $('.theemailbody').scrollTop(savedScroll);
      } else {
        $('.theemailbody').scrollTop(0);
      }
    }
  }
  
  // Update UI state
  $('.anemailhi').removeClass('anemailhi');
  $(this).addClass('anemailhi');
  $(this).removeClass('emailunread');
}

/**
 * Spawns reply window
 * @param {string} id - Comment ID to reply to
 */
function spawnReplyWindow(id) {
  new EmailWindow('', '', `reply ${id}`, '', 'Type your reply below:', '\n\n', false);
}

/**
 * Spawns command window with usage instructions
 */
function spawnCommandWindow() {
  const usage = `Usage:

Add subreddits:
\tIn the TO field, type subreddit [subredditname]+
\texample: subreddit starcraft linux programming

Go to a comments page:
\tJust paste in the link in the to field and hit send! example:
\thttp://www.reddit.com/r/gaming/comments/jkiu2/battlefield_3_caspian_border_gameplay_hd`;
  
  new EmailWindow('', '', '', '', '', usage, true);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

$(document).ready(function() {
  // Initialize random names from API
  initializeRandomNames();
  
  // Setup infinite scroll
  const previewArea = document.getElementById('previewarea');
  if (previewArea) {
    previewArea.addEventListener('scroll', handleInfiniteScroll);
  }
  
  // Setup resize handler
  onResize();
  $(window).on('resize', onResize);
  
  // Setup button handlers
  $('.newemailbutton').on('click', addSubReddit);
  $('.deletebutton').on('click', deleteCurrentFolder);
  $('.replybutton').on('click', refreshCurrentFolder);
  
  // Create default folders
  const mainInbox = makeFolder('Front Page');
  DEFAULT_SUBREDDITS.forEach(subreddit => {
    makeFolder(subreddit);
  });
  
  // Select Front Page
  $('#folder_FrontPage').parent().addClass('foldwraphi');
  folderClick('folder_FrontPage');
  
  // Setup Outlook minimize button
  $('.outlookmin').on('click', function() {
    for (const key in AppState.globalWindowDict) {
      if (AppState.globalWindowDict.hasOwnProperty(key)) {
        AppState.globalWindowDict[key].minimize();
      }
    }
    $(this).addClass('outlookminhi');
  });
  
  // Setup keyboard shortcuts (R key for reply)
  $('.authorandstuff').on('keyup', function(event) {
    if (event.keyCode === 82) { // R key
      const id = $('.commentroothi').parent().attr('id');
      if (id) {
        spawnReplyWindow(id);
      } else {
        spawnCommandWindow();
      }
    }
  });
  
  // Event delegation for expando clicks
  $('.theemailbody').on('click', '.expando', expandoClick);
});
