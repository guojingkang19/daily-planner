class Gestures {
  constructor(cb) { this.cb = cb; }
  attachCard(card, taskId) {
    let act = null;
    card.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      e.preventDefault();
      let r = card.getBoundingClientRect();
      let onGrip = !!(e.target && e.target.closest && e.target.closest('.grip'));
      if (!onGrip) return; // Only start drag from grip
      act = { card, offY: e.clientY - r.top, drag: false,
        timer: setTimeout(() => {
          act.drag = true;
          card.classList.add('dragging');
          card.style.cssText = 'position:fixed;z-index:100;height:'+r.height+'px;width:'+r.width+'px;left:'+r.left+'px;top:'+r.top+'px;transform:scale(1.03);box-shadow:0 8px 30px rgba(0,0,0,0.12)';
          if (navigator.vibrate) navigator.vibrate(10);
        }, 300)
      };
      try { card.setPointerCapture(e.pointerId); } catch(e) {}
    });
    card.addEventListener('pointermove', e => {
      if (!act || !act.drag) return;
      e.preventDefault();
      card.style.top = (e.clientY - act.offY) + 'px';
      let w = card.parentElement, c = w.parentElement, after = null;
      c.querySelectorAll('.card-wrapper').forEach(wr => {
        let r = wr.getBoundingClientRect();
        if (e.clientY > r.top + r.height/2) after = wr;
      });
      if (after && after !== w) c.insertBefore(w, after.nextSibling);
      else if (!after) c.insertBefore(w, c.firstChild);
    });
    card.addEventListener('pointerup', e => {
      clearTimeout(act?.timer);
      if (act?.drag) {
        card.classList.remove('dragging'); card.style.cssText = '';
        let order = [];
        card.parentElement.parentElement.querySelectorAll('.card-wrapper').forEach(w => {
          let c = w.querySelector('.task-card');
          if (c) order.push(c.dataset.taskId);
        });
        if (this.cb.onReorder) this.cb.onReorder(taskId, order);
      }
      act = null;
    });
    card.addEventListener('pointercancel', () => {
      clearTimeout(act?.timer);
      if (act?.drag) { card.classList.remove('dragging'); card.style.cssText = ''; }
      act = null;
    });
  }
}
