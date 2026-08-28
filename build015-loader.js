(() => {
  if (!document.querySelector('link[href="./build015.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './build015.css';
    document.head.appendChild(link);
  }
  import('./build015-adventure-visual.js').catch(error => console.warn('Zero2Fit Build 015 Adventure visual layer failed to load', error));
})();
