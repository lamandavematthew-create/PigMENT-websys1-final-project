(function(){'use strict';
const base='../../api/';const feedback=document.querySelector('#admin-feedback');const $=s=>document.querySelector(s);
const escapeText=s=>String(s??'');
async function call(path,method='GET',data){const headers={Accept:'application/json'};if(method!=='GET'){const token=await window.PigmentAuth.getCsrfToken();headers['X-CSRF-Token']=token;headers['Content-Type']='application/json';}const response=await fetch(base+path,{method,headers,credentials:'same-origin',...(method==='GET'&&(path==='admin-dashboard.php'||path.startsWith('admin-marketplace.php?')||path.startsWith('admin-users.php?'))?{cache:'no-store'}:{}),...(data?{body:JSON.stringify(data)}:{})});const payload=await response.json().catch(()=>null);if(!response.ok||payload?.status!=='success')throw new Error(payload?.message||'Unable to complete request.');return payload.data;}
function status(message){feedback.textContent=message;}function td(row,value){const cell=row.insertCell();cell.textContent=escapeText(value);return cell;}
function button(cell,label,handler){const b=document.createElement('button');b.type='button';b.className='button button-secondary button-small';b.textContent=label;b.addEventListener('click',handler);cell.append(b);}
const metrics = {
  farmers: '#metric-farmers',
  active_listings: '#metric-listings',
  pending_reports: '#metric-reports',
  published_zones: '#metric-zones'
};
let overviewRequest = 0;
async function overview() {
  const request = ++overviewRequest;
  const refresh = $('#overview-refresh');
  const wrap = $('#attention-list');
  const table = $('#attention-table');
  const message = $('#attention-message');
  const isCurrent = () => request === overviewRequest && !$('#overview').hidden;

  refresh.disabled = true;
  status('Loading overview…');
  wrap.replaceChildren();
  table.hidden = true;
  message.textContent = '';
  for (const selector of Object.values(metrics)) {
    $(selector).textContent = '—';
    $(selector).classList.remove('is-unavailable');
  }
  $('#stat-reports').classList.remove('has-pending');

  try {
    const data = await call('admin-dashboard.php');
    if (!isCurrent()) return;
    if (!data || typeof data !== 'object') throw new Error('Unable to load admin overview.');

    for (const [key, selector] of Object.entries(metrics)) {
      const available = Number.isInteger(data[key]);
      $(selector).textContent = available ? data[key] : 'Unavailable';
      $(selector).classList.toggle('is-unavailable', !available);
    }

    $('#stat-reports').classList.toggle('has-pending', Number.isInteger(data.pending_reports) && data.pending_reports > 0);

    if (!Array.isArray(data.attention)) {
      message.textContent = 'The report queue is unavailable.';
    } else if (!data.attention.length) {
      message.textContent = 'No reports are waiting for review.';
    } else {
      for (const item of data.attention) {
        const row = wrap.insertRow();
        const identity = row.insertCell();
        const label = document.createElement('strong');
        label.textContent = `Report #${item.report_id}`;
        const disease = document.createElement('small');
        disease.textContent = item.disease_type || 'Not specified';
        identity.append(label, disease);
        td(row, item.municipality || 'Not specified');
        const pending = item.report_status === 'pending';
        const badge = document.createElement('span');
        badge.className = 'attention-badge' + (pending ? '' : ' in-review');
        badge.textContent = pending ? 'Pending review' : 'Under review';
        row.insertCell().append(badge);
        const link = document.createElement('a');
        link.className = 'button button-primary attention-review';
        link.href = 'admin-dashboard.html?report=' + encodeURIComponent(item.report_id) + '#reports';
        link.textContent = 'Review report';
        link.setAttribute('aria-label', `Review report #${item.report_id}`);
        row.insertCell().append(link);
      }
      table.hidden = false;
    }

    const incomplete = !Array.isArray(data.attention)
      || Object.keys(metrics).some(key => !Number.isInteger(data[key]));
    status(incomplete ? 'Some overview data is unavailable. Select Refresh overview to try again.' : '');
  } catch (error) {
    if (!isCurrent()) return;
    for (const selector of Object.values(metrics)) {
      $(selector).textContent = 'Unavailable';
      $(selector).classList.add('is-unavailable');
    }
    message.textContent = 'The report queue could not be loaded.';
    status(error.message + ' Select Refresh overview to try again.');
  } finally {
    if (request === overviewRequest) refresh.disabled = false;
  }
}
const listingPrices = new Intl.NumberFormat('en-PH', {style:'currency', currency:'PHP', minimumFractionDigits:0, maximumFractionDigits:2});
const listingStates = {active:'Active', sold:'Sold', inactive:'Inactive'};
let listingRequest = 0;
let listingSaving = false;

function listingBadge(cell, label, tone) {
  const badge = document.createElement('span');
  badge.className = 'market-admin-badge' + (tone ? ' is-' + tone : '');
  badge.textContent = label;
  cell.append(badge);
}

async function marketplace(successMessage = '') {
  const request = ++listingRequest;
  const current = () => request === listingRequest && !$('#marketplace').hidden;
  const message = $('#listing-message');
  const submit = $('#listing-refresh');
  const results = $('#listing-results');
  const body = $('#listing-rows');
  const actionHeading = $('#listing-action-heading');
  const count = $('#listing-count');
  const query = new URLSearchParams({search:$('#listing-search').value.trim(), status:$('#listing-status').value});

  status('');
  submit.disabled = true;
  message.textContent = 'Loading listings…';
  results.hidden = true;
  count.textContent = '';
  body.replaceChildren();
  try {
    const data = await call('admin-marketplace.php?' + query);
    if (!current()) return;
    const ready = data.moderation_ready === true;
    actionHeading.hidden = !ready;
    const rows = data.listings;
    for (const item of rows) {
      const row = body.insertRow();
      const cell = (label, value = '') => {
        const el = td(row, value);
        el.dataset.label = label;
        return el;
      };
      const title = document.createElement('strong');
      title.textContent = item.listing_title;
      const id = document.createElement('small');
      id.textContent = '#' + item.listing_id;
      cell('Listing').append(title, id);
      cell('Seller', [item.first_name, item.last_name].filter(Boolean).join(' ') || '—');
      const price = Number(item.asking_price);
      cell('Price', item.asking_price != null && Number.isFinite(price) ? listingPrices.format(price) : '—');
      const state = item.listing_status;
      const hidden = Number(item.is_hidden) === 1;
      listingBadge(cell('Status'), Object.hasOwn(listingStates, state) ? listingStates[state] : 'Unknown', state === 'active' ? 'active' : '');
      const visibility = cell('Farmer marketplace');
      if (hidden) listingBadge(visibility, 'Hidden', 'hidden');
      else if (state === 'active' && item.seller_account_status === 'active') listingBadge(visibility, 'Listed', 'listed');
      else if (state === 'active' && item.seller_account_status == null) listingBadge(visibility, 'Unknown');
      else listingBadge(visibility, 'Not listed');

      if (!ready) continue;
      const action = cell('Action');
      button(action, hidden ? 'Restore' : 'Hide', async () => {
        if (listingSaving) return;
        if (hidden) {
          if (await window.PigmentModal.ask({title:'Restore listing?', message:'Remove the moderation restriction? Only active listings from active sellers can appear.', accept:'Restore listing'})) await changeListing(item, false, '');
          return;
        }
        const reason = await window.PigmentModal.requestText({
          title:'Hide listing?',
          message:'This listing will no longer appear in the farmer marketplace. Enter a reason to continue.',
          label:'Reason for hiding',
          accept:'Hide listing',
          tone:'danger',
          validate:value => value.length < 5 || new TextEncoder().encode(value).length > 500
            ? 'Enter a reason of at least 5 characters and no more than 500 bytes.' : ''
        });
        if (reason !== null) await changeListing(item, true, reason);
      });
      action.lastElementChild.setAttribute('aria-label', (hidden ? 'Restore' : 'Hide') + ' listing #' + item.listing_id);
    }
    count.textContent = rows.length === 200 ? '200 listings shown · Refine search to see other matches' : rows.length + (rows.length === 1 ? ' listing shown' : ' listings shown');
    results.hidden = rows.length === 0;
    message.textContent = [successMessage, rows.length ? '' : 'No listings match your search and status filter.'].filter(Boolean).join(' ');
  } catch (error) {
    if (!current()) return;
    message.textContent = error.message;
  } finally {
    if (request === listingRequest) submit.disabled = false;
  }
}

async function changeListing(item, hidden, reason) {
  listingSaving = true;
  const request = listingRequest;
  const controls = [...document.querySelectorAll('#listing-rows button'), $('#listing-refresh')];
  controls.forEach(control => { control.disabled = true; });
  $('#listing-message').textContent = 'Saving moderation change…';
  try {
    await call('admin-marketplace.php','PATCH',{listing_id:Number(item.listing_id),is_hidden:hidden,reason});
    if (!$('#marketplace').hidden) await marketplace(hidden ? 'Listing hidden.' : 'Moderation restriction removed.');
  } catch (error) {
    if (!$('#marketplace').hidden && request === listingRequest) $('#listing-message').textContent = error.message;
  } finally {
    listingSaving = false;
    if (request === listingRequest) controls.forEach(control => { control.disabled = false; });
  }
}
let accountRequest = 0;
let accountSaving = false;

async function users(successMessage = '') {
  const request = ++accountRequest;
  const current = () => request === accountRequest && !$('#users').hidden;
  const submit = $('#user-refresh');
  const result = $('#user-results');
  const message = $('#user-message');
  const count = $('#account-count');
  const body = $('#user-rows');
  const query = new URLSearchParams({search:$('#user-search').value.trim(), status:$('#user-status').value});

  status('');
  submit.disabled = true;
  result.hidden = true;
  count.hidden = true;
  message.textContent = 'Loading accounts…';
  body.replaceChildren();

  try {
    const rows = await call('admin-users.php?' + query);
    if (!current()) return;
    for (const item of rows) {
      const row = body.insertRow();
      const cell = (label, value = '') => {
        const el = td(row, value);
        el.dataset.label = label;
        return el;
      };
      const name = [item.first_name, item.last_name].filter(Boolean).join(' ') || item.email || 'Farmer #' + item.user_id;
      const title = document.createElement('strong');
      title.textContent = name;
      cell('Farmer').append(title);
      cell('Email', item.email || '—');
      cell('Municipality', item.municipality || '—');
      const active = item.account_status === 'active';
      const suspended = item.account_status === 'suspended';
      const state = cell('Status');
      listingBadge(state, active ? 'Active' : suspended ? 'Suspended' : item.account_status || 'Unknown', active ? 'active' : suspended ? 'suspended' : '');
      state.lastElementChild.classList.add('account-status');
      const action = cell('Action');
      if (!active && !suspended) {
        action.textContent = '—';
        continue;
      }
      const verb = active ? 'Suspend' : 'Reactivate';
      const next = active ? 'suspended' : 'active';
      button(action, verb, () => openAccountConfirmation(item, next, name));
      const control = action.lastElementChild;
      control.setAttribute('aria-label', verb + ' ' + name);
      control.classList.add('account-action');
      if (active) control.classList.add('is-suspend');
    }
    count.textContent = rows.length === 200 ? '200 accounts shown · Refine search to see other matches' : rows.length + (rows.length === 1 ? ' account shown' : ' accounts shown');
    count.hidden = false;
    result.hidden = rows.length === 0;
    message.textContent = [successMessage, rows.length ? '' : 'No farmer accounts match your search and status filter.'].filter(Boolean).join(' ');
  } catch (error) {
    if (current()) message.textContent = [successMessage, error.message].filter(Boolean).join(' ');
  } finally {
    if (request === accountRequest) submit.disabled = false;
  }
}

const accountDialog = $('#account-confirm-dialog');
let pendingAccountAction = null;

function openAccountConfirmation(item, next, name) {
  if (accountSaving || accountDialog.open || $('#users').hidden) return;
  const suspend = next === 'suspended';
  pendingAccountAction = {userId:item.user_id, next, name};
  accountDialog.dataset.intent = suspend ? 'suspend' : 'reactivate';
  $('#account-confirm-title').textContent = suspend ? 'Suspend this account?' : 'Reactivate this account?';
  $('#account-confirm-identity').textContent = item.email && item.email !== name ? name + ' (' + item.email + ')' : name;
  $('#account-confirm-effect').textContent = suspend
    ? 'This will block sign-in and access to protected features until the account is reactivated.'
    : 'This will restore sign-in and access to protected features.';
  $('#account-confirm-submit').textContent = suspend ? 'Suspend account' : 'Reactivate account';
  accountDialog.showModal();
}

function closeAccountConfirmation() {
  pendingAccountAction = null;
  if (accountDialog.open) accountDialog.close();
}

$('#account-confirm-cancel').addEventListener('click', closeAccountConfirmation);
accountDialog.addEventListener('cancel', closeAccountConfirmation);
$('#account-confirm-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!accountDialog.open || !pendingAccountAction || accountSaving || $('#users').hidden) return;
  const {userId, next, name} = pendingAccountAction;
  closeAccountConfirmation();
  await saveAccountStatus(userId, next, name);
  // The table was rebuilt after saving, so focus the result instead of a removed row button.
  if (!$('#users').hidden && document.activeElement === document.body) $('#user-message').focus({preventScroll:true});
});

async function saveAccountStatus(userId, next, name) {
  accountSaving = true;
  const request = accountRequest;
  const controls = [...document.querySelectorAll('#user-rows button'), $('#user-refresh')];
  controls.forEach(control => { control.disabled = true; });
  $('#user-message').textContent = 'Updating account access…';
  try {
    await call('admin-users.php','PATCH',{user_id:Number(userId),account_status:next});
    if (!$('#users').hidden) await users(name + (next === 'active' ? ' was reactivated.' : ' was suspended.'));
  } catch (error) {
    if (!$('#users').hidden && request === accountRequest) $('#user-message').textContent = error.message;
  } finally {
    accountSaving = false;
    if (request === accountRequest) controls.forEach(control => { control.disabled = false; });
  }
}
const views = {
  overview: ['Admin Overview', 'Monitor reports, listings, and farmer accounts.', overview],
  reports: ['Review disease reports', 'Review farmer submissions and track decisions.'],
  zones: ['Infected zones', 'Manage zone boundaries and what appears on the farmer map.'],
  marketplace: ['Marketplace moderation', 'Manage which listings appear in the farmer marketplace.', marketplace],
  users: ['Farmer accounts', 'Find accounts and manage access.', users]
};
let authenticated = false;
let previousView;
function show() {
  if (!authenticated) return;
  const requested = location.hash.slice(1);
  const name = Object.hasOwn(views, requested) ? requested : 'overview';
  if (requested !== name) history.replaceState(null, '', '#'+name);
  const [heading, description, load] = views[name];
  if (name !== 'users') closeAccountConfirmation();
  document.querySelectorAll('.admin-view').forEach(el => { el.hidden = el.id !== name; });
  document.querySelectorAll('[data-view]').forEach(el => {
    const active = el.dataset.view === name;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  const main = $('.admin-main');
  main.dataset.currentView = name;
  for (const className of ['disease-page', 'disease-review-page']) {
    main.classList.toggle(className, name === 'reports' || name === 'zones');
  }
  $('#overview-refresh').hidden = name !== 'overview';
  $('#current-heading').textContent = heading;
  $('#current-description').textContent = description;
  if (previousView !== name) {
    status('');
    if (previousView) $('#current-heading').focus({preventScroll: true});
    window.scrollTo(0, 0);
    previousView = name;
  }
  window.dispatchEvent(new CustomEvent('pigment:admin-view', {detail: name}));
  load?.();
}
window.addEventListener('hashchange',show);$('#overview-refresh').addEventListener('click',overview);$('#listing-filters').addEventListener('submit', event => { event.preventDefault(); if (!listingSaving) marketplace(); });$('#user-filters').addEventListener('submit', event => { event.preventDefault(); if (!accountSaving) users(); });document.addEventListener('DOMContentLoaded',async()=>{try{const session=await window.PigmentAuth.getSession();if(!session||session.role!=='admin')return;authenticated=true;show();}catch(e){status('Session verification failed.');}});
})();
