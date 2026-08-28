(() => {
  if (!document.querySelector('link[href="./build016.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './build016.css';
    document.head.appendChild(link);
  }
  import('./build016-fuel.js').catch(error => console.warn('Zero2Fit Build 016 Fuel layer failed to load', error));
})();
