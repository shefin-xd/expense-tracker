# Real-browser walkthrough of the three-part setup: API, expenses app, and the separate sign-in app.
# Needs: API on :4000 (AUTH_URL=http://localhost:4174), `vite preview` of client on :4173 (built with VITE_AUTH_URL=http://localhost:4174)
# and of auth on :4174 (built with VITE_APP_URL=http://localhost:4173), Firefox + geckodriver, `pip install selenium`.
# Start with an empty database. Env: BASE_URL, AUTH_URL, FIREFOX_BIN, GECKODRIVER, DOWNLOAD_DIR, SHOT_DIR, SERVER_LOG.
import os, sys, time, datetime, traceback, re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import ElementClickInterceptedException, ElementNotInteractableException
from selenium.webdriver.remote.webelement import WebElement

# A banner or an animation can sit over a button for a moment: retry, then fall back to a script click.
_orig_click = WebElement.click
def _click(self):
    for _ in range(8):
        try: return _orig_click(self)
        except (ElementClickInterceptedException, ElementNotInteractableException): time.sleep(0.4)  # still animating in
    self.parent.execute_script('arguments[0].click()', self)
WebElement.click = _click

BASE = os.environ.get('BASE_URL', 'http://localhost:4173')
AUTH = os.environ.get('AUTH_URL', 'http://localhost:4174')
DL = os.environ.get('DOWNLOAD_DIR', '/tmp/dl'); SHOTS = os.environ.get('SHOT_DIR', '/tmp/shots')
os.makedirs(DL, exist_ok=True); os.makedirs(SHOTS, exist_ok=True)
opts = Options()
if os.environ.get('FIREFOX_BIN'): opts.binary_location = os.environ['FIREFOX_BIN']
opts.add_argument('-headless')
for k, v in {'browser.download.folderList': 2, 'browser.download.dir': DL, 'browser.download.useDownloadDir': True,
             'browser.helperApps.neverAsk.saveToDisk': 'application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/json',
             'pdfjs.disabled': True, 'browser.download.manager.showWhenStarting': False}.items():
    opts.set_preference(k, v)
d = webdriver.Firefox(options=opts, service=Service(os.environ['GECKODRIVER']) if os.environ.get('GECKODRIVER') else Service())
d.set_window_size(1280, 900)
W = lambda t=15: WebDriverWait(d, t)
results = []; page_errors = []
def log(msg): print(msg, flush=True)
def shot(name): d.save_screenshot(f'{SHOTS}/{name}.png')
def check(name, cond, extra=''):
    results.append((name, bool(cond))); log(f"{'PASS' if cond else 'FAIL'}  {name} {extra if not cond else ''}")
    before = len(page_errors); collect()  # attribute any browser error to the step that just ran
    if len(page_errors) > before: log(f"   ^ browser error seen around this step: {page_errors[before:]}")
def q(s): return "'" + s + "'" if "'" not in s else '"' + s + '"'
def xp(x, t=15): return W(t).until(lambda _: next((e for e in d.find_elements(By.XPATH, x) if e.is_displayed()), None))
def has_text(t, to=15):
    try: xp(f"//*[contains(normalize-space(.), {q(t)}) and not(self::script) and not(.//*[contains(normalize-space(.), {q(t)})])]", to); return True
    except Exception: return False
def field(label, scope=None):
    root = scope or d
    lab = W().until(lambda _: next((l for l in root.find_elements(By.XPATH, f".//label[contains(normalize-space(.), {q(label)})]") if l.is_displayed()), None))
    return root.find_element(By.ID, lab.get_attribute('for'))
def fill(label, value, scope=None):
    el = field(label, scope); el.click(); el.send_keys(Keys.CONTROL, 'a'); el.send_keys(Keys.DELETE); el.send_keys(value)
def set_date(label, value, scope=None):
    el = field(label, scope)
    d.execute_script("Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(arguments[0],arguments[1]);arguments[0].dispatchEvent(new Event('input',{bubbles:true}));arguments[0].dispatchEvent(new Event('change',{bubbles:true}));", el, value)
def dialog(): return xp("//div[@role='dialog']")
def btn(text, scope=None):
    el = scope.find_element(By.XPATH, f".//button[normalize-space()={q(text)}]") if scope else xp(f"//button[normalize-space()={q(text)}]"); el.click(); return el
def nav(text): xp(f"//aside//a[contains(normalize-space(.), {q(text)})]").click(); time.sleep(0.4)
def balance(): return xp("//section[@aria-label='Balance overview']//p[contains(@class,'text-[42px]') or contains(@class,'text-[52px]')]").text
def wait_balance(expected, to=10):
    end = time.time() + to
    while time.time() < end:
        try:
            if balance() == expected: return True
        except Exception: pass
        time.sleep(0.3)
    return False
def toast(text): return has_text(text, 8)
def wait_url(prefix, to=15):
    # Compare the page address without its query string, so "?redirect=<app url>" can never satisfy a wait by accident.
    end = time.time() + to
    while time.time() < end:
        if d.current_url.split('?')[0].startswith(prefix): return True
        time.sleep(0.25)
    return False
# Console errors and CSP violations are collected per page; a full navigation drops the page, so collect before leaving.
HOOK = "if(!window.__errs){window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));window.addEventListener('securitypolicyviolation',e=>window.__errs.push('CSP '+e.violatedDirective+' '+e.blockedURI+' @'+e.sourceFile+':'+e.lineNumber+':'+e.columnNumber+' sample='+e.sample));window.addEventListener('unhandledrejection',e=>window.__errs.push('rejection '+String(e.reason)));var ce=console.error;console.error=function(){window.__errs.push([].join.call(arguments,' '));ce.apply(console,arguments)};}"
def hook():
    try: d.execute_script(HOOK)
    except Exception: pass
def collect():
    try: page_errors.extend(x for x in d.execute_script("return window.__errs || []") if 'ResizeObserver' not in x)
    except Exception: pass
def go(url): collect(); d.get(url); time.sleep(0.4); hook()
def no_overflow(): return d.execute_script("return document.documentElement.scrollWidth <= window.innerWidth + 1")
def logged_in_as(email, password, expect_url_part):
    fill('Email', email); fill('Password', password); btn('Sign in'); return wait_url(expect_url_part)

try:
    # ---------- separate sign-in app: redirect, register, return
    go(BASE + '/fees')
    check('signed-out visit is sent to the separate sign-in app', wait_url(AUTH + '/login') and 'redirect=' in d.current_url, d.current_url)
    hook(); shot('01-auth-login')
    xp("//a[normalize-space()='Create an account']").click()
    check('redirect choice survives moving to register', 'redirect=' in d.current_url and '/register' in d.current_url)
    fill('Full name', 'Shefin Franklin'); fill('Email', 'shefin@example.com'); fill('Password', 'Passw0rd!x')
    fill('College', 'College of Engineering Trivandrum'); fill('Department', 'Computer Science and Engineering'); fill('Hostel', "CET Men's Hostel")
    shot('02-auth-register'); btn('Create account')
    check('after register you are back on the page you asked for (fees)', wait_url(BASE + '/fees'), d.current_url)
    hook()
    nav('Dashboard')
    check('empty balance is ₹0.00', wait_balance('₹0.00'))
    check('new user sees the getting-started checklist', has_text('Getting started · 0 of 4'))
    shot('03-dashboard-empty')

    # ---------- money in, out, fees, lending
    btn('Money received'); dlg = dialog()
    check('"money received" presets parents', Select(field('Received from', dlg)).first_selected_option.text == 'Money from parents')
    fill('Amount', '10000', dlg); btn('Add income', dlg)
    check('balance = ₹10,000.00 after income', wait_balance('₹10,000.00'))
    check('checklist progresses to 1 of 4', has_text('Getting started · 1 of 4'))
    btn('Add expense'); dlg = dialog(); shot('04-quick-expense')
    fill('Amount', '250.50', dlg); btn('Add expense', dlg)
    check('balance = ₹9,749.50 after expense', wait_balance('₹9,749.50'))

    nav('Fees & Payments'); btn('Add fee'); dlg = dialog()
    fill('Fee name', 'Semester fee', dlg); fill('Total amount due', '5000', dlg)
    set_date('Due date', (datetime.date.today() + datetime.timedelta(days=30)).isoformat(), dlg); btn('Add fee', dlg)
    check('fee card appears as Pending', has_text('Semester fee') and has_text('Pending'))
    nav('Dashboard'); check('adding an unpaid fee does not change the balance', wait_balance('₹9,749.50'))
    nav('Fees & Payments'); btn('Record payment'); dlg = dialog(); fill('Amount paid', '1200', dlg); btn('Record payment', dlg)
    check('fee becomes Partially paid', has_text('Partially paid')); shot('05-fees')
    nav('Dashboard'); check('balance = ₹8,549.50 after ₹1,200 fee payment', wait_balance('₹8,549.50'))

    nav('Borrow & Lend'); btn('Record loan'); dlg = dialog()
    fill('Lent to', 'Arjun', dlg); fill('Amount', '500', dlg); btn('Record loan', dlg)
    check('loan listed', has_text('Arjun') and has_text('Pending'))
    nav('Dashboard'); check('balance = ₹8,049.50 after lending ₹500', wait_balance('₹8,049.50'))
    check('dashboard shows friends owe you', has_text('Friends owe you'))
    nav('Borrow & Lend'); btn('Record payback'); dlg = dialog(); fill('Amount received back', '200', dlg); btn('Record repayment', dlg)
    check('loan becomes Partially settled', has_text('Partially settled')); shot('06-borrow-lend')
    nav('Dashboard'); check('balance = ₹8,249.50 after ₹200 paid back', wait_balance('₹8,249.50'))

    nav('Budgets'); btn('Set budget'); dlg = dialog(); fill('Overall monthly limit', '5000', dlg)
    btn('Add category limit', dlg); Select(field('Category', dlg)).select_by_visible_text('Food'); fill('Limit', '1000', dlg); btn('Save budget', dlg)
    check('budget shows food used 25%', has_text('25% used')); shot('07-budgets')
    nav('Savings'); btn('Add goal'); dlg = dialog(); fill('Goal', 'Laptop', dlg); fill('Target amount', '60000', dlg); fill('Saved so far', '15000', dlg); btn('Add goal', dlg)
    check('savings goal at 25%', has_text('25%') and has_text('Laptop'))

    nav('Expenses'); xp("//button[@aria-label='Edit Food']").click(); dlg = dialog(); fill('Amount', '300', dlg); btn('Save changes', dlg)
    nav('Dashboard'); check('balance = ₹8,200.00 after editing expense to ₹300', wait_balance('₹8,200.00'))
    nav('Expenses'); xp("//button[@aria-label='Delete Food']").click(); btn('Delete expense', dialog())
    check('expense list empty after delete', has_text('No expenses yet'))
    nav('Dashboard'); check('balance restored to ₹8,500.00', wait_balance('₹8,500.00'))

    # ---------- monthly allowance: due, but nothing posts until confirmed
    nav('Income'); xp("//section[.//h2[normalize-space()='Monthly allowance']]//button[normalize-space()='Add']").click(); dlg = dialog()
    fill('Usual amount', '8000', dlg); btn('Add', dlg)
    check('monthly allowance appears as due', has_text('Due now'))
    nav('Dashboard'); check('a due allowance has not changed the balance', wait_balance('₹8,500.00'))
    check('dashboard shows it is waiting for you', has_text('Waiting for you'))
    shot('08-dashboard-waiting')
    btn('Confirm received'); dlg = dialog(); fill('Amount received', '7500', dlg); btn('Record money', dlg)
    check('balance = ₹16,000.00 after confirming ₹7,500', wait_balance('₹16,000.00'))
    check('waiting card disappears once confirmed', not has_text('Waiting for you', 3))
    check('checklist disappears when everything is set up', not has_text('Getting started', 3))
    nav('Expenses'); xp("//section[.//h2[normalize-space()='Monthly payments']]//button[normalize-space()='Add']").click(); dlg = dialog()
    fill('Name', 'Mess fee', dlg); fill('Usual amount', '3500', dlg); btn('Add', dlg)
    check('monthly payment added and due', has_text('Mess fee') and has_text('Due now'))
    btn('Skip this month'); check('skipping marks it upcoming', has_text('Upcoming'))
    nav('Dashboard'); check('skipping recorded nothing', wait_balance('₹16,000.00'))

    nav('Transactions'); check('transactions lists fee payment, loan and allowance', has_text('Semester fee payment') and has_text('Lent to Arjun') and has_text('Monthly allowance'))
    fld = xp("//input[@aria-label='Search transactions']"); fld.send_keys('arjun'); time.sleep(0.9)
    check('search narrows transactions', has_text('Lent to Arjun') and not has_text('Semester fee payment', 2)); shot('09-transactions')

    nav('Reports & Exports'); shot('10-reports')
    for fmt in ('PDF', 'Excel', 'CSV'):
        btn(f'Download {fmt}'); check(f'{fmt} download toast', toast(f'{fmt} report downloaded'))
    time.sleep(1.5); files = sorted(os.listdir(DL)); log(f'downloaded: {files}')
    for ext in ('pdf', 'xlsx', 'csv'):
        check(f'.{ext} file saved with server filename', any(f.startswith('campusledger-monthly-') and f.endswith('.' + ext) for f in files if not f.endswith('.part')))
    xp("//button[contains(@aria-label,'Notifications')]").click()
    check('bell lists export notifications', has_text('Export ready')); shot('11-notifications'); d.find_element(By.TAG_NAME, 'body').send_keys(Keys.ESCAPE)

    nav('Settings'); xp("//button[@role='tab' and normalize-space()='Dark']").click(); time.sleep(0.5)
    check('dark theme applied to page', 'dark' in d.find_element(By.TAG_NAME, 'html').get_attribute('class')); shot('12-settings-dark')
    nav('Dashboard'); time.sleep(1); shot('13-dashboard-dark')
    go(BASE + '/'); time.sleep(1.2); check('dark theme persists after reload', 'dark' in d.find_element(By.TAG_NAME, 'html').get_attribute('class'))
    nav('Settings'); xp("//button[@role='tab' and normalize-space()='Light']").click(); time.sleep(0.4)
    fill('Hostel', "CET Men's Hostel (Block A)"); btn('Save profile'); check('profile saved', toast('Profile saved'))
    fill('Current password', 'Passw0rd!x'); fill('New password', 'Changed123x'); fill('Confirm new password', 'Changed123x')
    btn('Change password'); check('password changed toast', toast('Password changed'))
    go(BASE + '/settings'); time.sleep(1.2); check('still signed in after changing password', has_text('Settings') and BASE in d.current_url and AUTH not in d.current_url)

    # ---------- layouts: tablet rail and desktop sidebar
    def aside_widths(): return d.execute_script("return [...document.querySelectorAll('aside')].filter(a=>getComputedStyle(a).display!=='none').map(a=>Math.round(a.getBoundingClientRect().width))")
    def bottom_nav_visible(): return d.execute_script("const n=document.querySelector('nav.fixed.bottom-0');return !!n && getComputedStyle(n).display!=='none'")
    for w, h, kind in ((1440, 900, 'sidebar'), (1280, 800, 'sidebar'), (1024, 768, 'sidebar'), (820, 1180, 'rail'), (768, 1024, 'rail'), (600, 900, 'tabbar'), (488, 844, 'tabbar')):
        d.set_window_size(w, h); go(BASE + '/'); time.sleep(1.2)
        iw = d.execute_script('return window.innerWidth')
        widths = aside_widths(); tab = bottom_nav_visible()
        ok = {'sidebar': widths == [272] and not tab, 'rail': widths == [76] and not tab, 'tabbar': widths == [] and tab}[kind]
        check(f'{w}px window ({iw}px viewport): {kind} layout', ok, f'asides={widths} tabbar={tab}')
        check(f'{w}px window: no horizontal overflow on dashboard', no_overflow())
        if w in (1440, 820, 488): shot(f'14-layout-{w}')
    d.set_window_size(1280, 900)

    # ---------- every page fits at a phone width, then sign out from the phone menu
    d.set_window_size(488, 844)
    for path, name in (('/transactions', 'transactions'), ('/expenses', 'expenses'), ('/income', 'income'), ('/fees', 'fees'), ('/borrow-lend', 'lend'), ('/budgets', 'budgets'), ('/savings', 'savings'), ('/reports', 'reports'), ('/settings', 'settings')):
        go(BASE + path); time.sleep(1.1); check(f'no horizontal overflow on phone {name}', no_overflow())
        if name in ('fees', 'income', 'settings'): shot(f'15-phone-{name}')
    go(BASE + '/'); time.sleep(1); xp("//button[@aria-label='Add expense']").click(); shot('16-phone-quick-add'); d.find_element(By.TAG_NAME, 'body').send_keys(Keys.ESCAPE)
    xp("//button[normalize-space()='More']").click(); btn('Sign out', dialog())
    check('sign out lands on the sign-in app with a signed-out notice', wait_url(AUTH + '/login') and has_text('You are signed out.')); hook()
    shot('17-phone-signed-out')
    go(BASE + '/expenses'); check('protected page redirects to sign-in after sign out', wait_url(AUTH + '/login'))
    d.set_window_size(1280, 900)

    # ---------- single sign-on, open-redirect protection, forgot/reset
    go(AUTH + '/login?redirect=' + BASE + '/budgets'); hook()
    check('sign in returns to the requested page', logged_in_as('shefin@example.com', 'Changed123x', BASE + '/budgets') and has_text('Budgets'))
    hook()
    go(AUTH + '/login?redirect=' + BASE + '/savings'); check('single sign-on: already signed in, so you are bounced straight back to the app', wait_url(BASE + '/savings') and has_text('Savings'))
    hook(); nav('Dashboard'); xp("//aside//button[normalize-space()='Sign out']").click(); check('sign out from desktop', wait_url(AUTH + '/login'))
    go(AUTH + '/login?redirect=https://evil.example/phish'); hook()
    ok = logged_in_as('shefin@example.com', 'Changed123x', BASE)
    time.sleep(1.5); check('a redirect to another site is ignored: you land in the app', ok and d.current_url.startswith(BASE) and 'evil' not in d.current_url, d.current_url)
    hook(); nav('Dashboard'); xp("//aside//button[normalize-space()='Sign out']").click(); wait_url(AUTH + '/login')

    server_log = os.environ.get('SERVER_LOG')
    if server_log:
        hook(); xp("//a[normalize-space()='Forgot password?']").click(); fill('Email', 'shefin@example.com'); btn('Send reset link')
        check('forgot password confirms neutrally', has_text('a reset link is on its way')); time.sleep(1.5)
        tokens = re.findall(r'(http\S+/reset-password\?token=[a-f0-9]{64})', open(server_log).read())
        check('reset link was emailed and points at the sign-in app', bool(tokens) and tokens[-1].startswith(AUTH), tokens[-1:] )
        link = tokens[-1]
        go(link); fill('New password', 'Reset456xyz'); fill('Confirm new password', 'Reset456xyz'); btn('Change password')
        check('reset returns to sign in with a success notice', wait_url(AUTH + '/login') and has_text('Password changed'))
        go(link); fill('New password', 'Another789xyz'); fill('Confirm new password', 'Another789xyz'); btn('Change password')
        check('used reset link is refused', has_text('expired or was already used'))
        go(AUTH + '/login'); fill('Email', 'shefin@example.com'); fill('Password', 'Changed123x'); btn('Sign in')
        check('old password no longer works', has_text('do not match'))
        fill('Password', 'Reset456xyz'); btn('Sign in')
        check('new password signs in with data intact', wait_url(BASE) and has_text('Available balance') and wait_balance('₹16,000.00')); hook()
        xp("//aside//button[normalize-space()='Sign out']").click(); wait_url(AUTH + '/login')

    # ---------- a second user sees none of it
    go(AUTH + '/register'); fill('Full name', 'Bob Other'); fill('Email', 'bob@example.com'); fill('Password', 'Passw0rd!x'); fill('Department', 'ECE'); btn('Create account')
    check('second user starts at ₹0.00', wait_url(BASE) and has_text('Available balance') and wait_balance('₹0.00')); hook()
    nav('Transactions'); check('second user has no transactions', has_text('No transactions yet'))
    nav('Fees & Payments'); check('second user has no fees', has_text('No fees added yet'))
    nav('Expenses'); check('second user sees no monthly payments of the first', not has_text('Mess fee', 2))
    nav('Income'); check('second user sees no monthly allowance of the first', not has_text('Due now', 2))
    collect()
    check('no console errors, rejections or CSP violations on any page', not page_errors, str(page_errors[:5]))
except Exception as ex:
    log('EXCEPTION: ' + repr(ex)); traceback.print_exc(); shot('zz-failure')
    log('URL: ' + d.current_url); collect(); log('errs: ' + str(page_errors[:5]))
finally:
    d.quit()
    fails = [n for n, ok in results if not ok]
    log(f'\n{len(results)-len(fails)}/{len(results)} checks passed')
    if fails: log('FAILED: ' + '; '.join(fails))
    sys.exit(1 if fails else 0)
