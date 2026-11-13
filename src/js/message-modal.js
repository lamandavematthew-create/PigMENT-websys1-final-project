(() => {
  'use strict';

  let view;
  let queue = Promise.resolve();

  function getView() {
    if (view) return view;
    const dialog = document.createElement('dialog');
    dialog.className = 'pigment-message-modal';
    dialog.setAttribute('aria-labelledby', 'pigment-message-title');
    dialog.setAttribute('aria-describedby', 'pigment-message-body');
    dialog.innerHTML = `
      <form>
        <p class="pigment-message-kicker">PigMENT</p>
        <h2 id="pigment-message-title"></h2>
        <p id="pigment-message-body"></p>
        <div class="pigment-message-input" hidden>
          <label for="pigment-message-text"></label>
          <textarea id="pigment-message-text" rows="3"></textarea>
          <p class="pigment-message-error" role="status"></p>
        </div>
        <div class="pigment-message-actions">
          <button type="button" class="pigment-message-cancel">Cancel</button>
          <button type="submit" class="pigment-message-submit"></button>
        </div>
      </form>`;
    document.body.append(dialog);
    const find = selector => dialog.querySelector(selector);
    view = {
      dialog, form: find('form'), title: find('h2'), body: find('#pigment-message-body'),
      field: find('.pigment-message-input'), label: find('label'), input: find('textarea'),
      error: find('.pigment-message-error'), cancel: find('.pigment-message-cancel'), submit: find('.pigment-message-submit')
    };
    return view;
  }

  function show(mode, options) {
    return new Promise(resolve => {
      const v = getView();
      const previous = document.activeElement;
      const text = mode === 'text';
      const notice = mode === 'notice';
      const dismissed = text ? null : false;
      let result = dismissed;

      v.title.textContent = options.title || 'PigMENT';
      v.body.textContent = options.message || '';
      v.dialog.dataset.tone = options.tone || 'default';
      v.field.hidden = !text;
      v.cancel.hidden = notice;
      v.input.value = '';
      v.input.maxLength = options.maxLength || 500;
      v.label.textContent = options.label || 'Reason';
      v.error.textContent = '';
      v.submit.textContent = options.accept || (notice ? 'OK' : 'Continue');

      const dismiss = () => v.dialog.close();
      const onCancel = event => { event.preventDefault(); dismiss(); };
      const onSubmit = event => {
        event.preventDefault();
        if (text) {
          const value = v.input.value.trim();
          const error = options.validate?.(value);
          if (error) {
            v.error.textContent = error;
            v.input.focus();
            return;
          }
          result = value;
        } else result = true;
        v.dialog.close();
      };
      const onClose = () => {
        v.form.removeEventListener('submit', onSubmit);
        v.cancel.removeEventListener('click', dismiss);
        v.dialog.removeEventListener('cancel', onCancel);
        if (previous?.isConnected) previous.focus({preventScroll:true});
        resolve(result);
      };

      v.form.addEventListener('submit', onSubmit);
      v.cancel.addEventListener('click', dismiss);
      v.dialog.addEventListener('cancel', onCancel);
      v.dialog.addEventListener('close', onClose, {once:true});
      v.dialog.showModal();
      (text ? v.input : notice ? v.submit : v.cancel).focus();
    });
  }

  function enqueue(mode, options) {
    const next = queue.then(() => show(mode, options));
    queue = next.catch(() => {});
    return next;
  }

  window.PigmentModal = Object.freeze({
    ask: options => enqueue('confirm', options),
    requestText: options => enqueue('text', options),
    notify: options => enqueue('notice', options)
  });
})();
