export const scrollToTop = (smooth = false) => {
  window.scrollTo({
    top: 0,
    behavior: smooth ? 'smooth' : 'auto'
  });
};

export const preventScroll = () => {
  document.body.style.overflow = 'hidden';
};

export const enableScroll = () => {
  document.body.style.overflow = 'auto';
};

export const getScrollPosition = () => ({
  x: window.pageXOffset,
  y: window.pageYOffset
}); 