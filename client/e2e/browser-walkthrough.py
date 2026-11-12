import os, sys, time, datetime, glob, traceback
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.common.keys import Keys

# Real-browser walkthrough: needs the API on :4000, `vite preview` on :4173, Firefox + geckodriver, and `pip install selenium`.
# Start with an empty database. Env: BASE_URL, FIREFOX_BIN, GECKODRIVER, DOWNLOAD_DIR, SHOT_DIR.
BASE = os.environ.get('BASE_URL', 'http://localhost:4173')
DL = os.environ.get('DOWNLOAD_DIR', '/tmp/dl'); SHOTS = os.environ.get('SHOT_DIR', '/tmp/shots'); os.makedirs(DL, exist_ok=True); os.makedirs(SHOTS, exist_ok=True)
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
results = []
def log(msg): print(msg, flush=True)
def shot(name): d.save_screenshot(f'{SHOTS}/{name}.png')
def check(name, cond, extra=''):
    results.append((name, bool(cond)))
    log(f"{'PASS' if cond else 'FAIL'}  {name} {extra if not cond else ''}")

def xp(x, t=15): return W(t).until(lambda _: next((e for e in d.find_elements(By.XPATH, x) if e.is_displayed()), None))
def has_text(t, to=15):
    try: xp(f"//*[contains(normalize-space(.), {q(t)}) and not(self::script) and not(.//*[contains(normalize-space(.), {q(t)})])]", to); return True
    except Exception: return False
def q(s): return "'" + s + "'" if "'" not in s else '"' + s + '"'
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
def click(x, scope=None):
    el = (scope or d).find_element(By.XPATH, x) if scope else xp(x); el.click(); return el
def btn(text, scope=None): return click(f".//button[normalize-space()={q(text)}]" if scope else f"//button[normalize-space()={q(text)}]", scope)
def nav(text):
    xp(f"//aside//a[contains(normalize-space(.), {q(text)})]").click(); time.sleep(0.4)
def balance(): return xp("//section[@aria-label='Balance overview']//p[contains(@class,'text-4xl') or contains(@class,'text-5xl')]").text
def wait_balance(expected, to=10):
    end = time.time() + to
    while time.time() < end:
        try:
            if balance() == expected: return True
        except Exception: pass
        time.sleep(0.3)
    return False
def toast(text): return has_text(text, 8)
def errs(): return d.execute_script("return window.__errs || []")

try:
    d.get(BASE + '/')
    check('signed-out visit redirects to login', has_text('Sign in') and '/login' in d.current_url)
    d.execute_script("window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));window.addEventListener('unhandledrejection',e=>window.__errs.push('rejection '+String(e.reason)));var ce=console.error;console.error=function(){window.__errs.push([].join.call(arguments,' '));ce.apply(console,arguments)};")
    shot('01-login')

    # ---- register
    xp("//a[contains(.,'Create an account')]").click()
    fill('Full name', 'Shefin Franklin'); fill('Email', 'shefin@example.com'); fill('Password', 'Passw0rd!x')
    fill('College', 'College of Engineering Trivandrum'); fill('Department', 'Computer Science and Engineering'); fill('Hostel', "CET Men's Hostel")
    btn('Create account')
    check('register lands on dashboard', has_text('Available balance'))
    check('empty balance is ₹0.00', wait_balance('₹0.00'))
    check('empty state offers first step', has_text('Nothing recorded yet'))
    shot('02-dashboard-empty')

    # ---- money received (quick action)
    btn('Money received'); dlg = dialog()
    check('"money received" presets parents', Select(field('Received from', dlg)).first_selected_option.text == 'Money from parents')
    fill('Amount', '10000', dlg); btn('Add income', dlg)
    check('balance = ₹10,000.00 after income', wait_balance('₹10,000.00'))

    # ---- quick expense from the top bar
    btn('Add expense'); dlg = dialog(); shot('03-quick-expense')
    fill('Amount', '250.50', dlg); btn('Add expense', dlg)
    check('balance = ₹9,749.50 after expense', wait_balance('₹9,749.50'))

    # ---- fee + partial payment
    nav('Fees & Payments'); btn('Add fee'); dlg = dialog()
    fill('Fee name', 'Semester fee', dlg); fill('Total amount due', '5000', dlg)
    set_date('Due date', (datetime.date.today() + datetime.timedelta(days=30)).isoformat(), dlg); btn('Add fee', dlg)
    check('fee card appears as Pending', has_text('Semester fee') and has_text('Pending'))
    nav('Dashboard'); check('adding an unpaid fee does not change the balance', wait_balance('₹9,749.50'))
    nav('Fees & Payments'); btn('Record payment'); dlg = dialog(); fill('Amount paid', '1200', dlg); btn('Record payment', dlg)
    check('fee becomes Partially paid', has_text('Partially paid'))
    shot('04-fees')
    nav('Dashboard'); check('balance = ₹8,549.50 after ₹1,200 fee payment', wait_balance('₹8,549.50'))

    # ---- lend
    nav('Borrow & Lend'); btn('Record loan'); dlg = dialog()
    fill('Lent to', 'Arjun', dlg); fill('Amount', '500', dlg); btn('Record loan', dlg)
    check('loan listed', has_text('Arjun') and has_text('Pending'))
    nav('Dashboard'); check('balance = ₹8,049.50 after lending ₹500', wait_balance('₹8,049.50'))
    check('dashboard shows friends owe you', has_text('Friends owe you'))
    nav('Borrow & Lend'); btn('Record payback'); dlg = dialog(); fill('Amount received back', '200', dlg); btn('Record repayment', dlg)
    check('loan becomes Partially settled', has_text('Partially settled'))
    shot('05-borrow-lend')

    # ---- budget
    nav('Budgets'); btn('Set budget'); dlg = dialog(); fill('Overall monthly limit', '5000', dlg)
    btn('Add category limit', dlg); Select(field('Category', dlg)).select_by_visible_text('Food'); fill('Limit', '1000', dlg); btn('Save budget', dlg)
    check('budget shows food used 25%', has_text('25% used'))
    shot('06-budgets')

    # ---- savings
    nav('Savings'); btn('Add goal'); dlg = dialog(); fill('Goal', 'Laptop', dlg); fill('Target amount', '60000', dlg); fill('Saved so far', '15000', dlg); btn('Add goal', dlg)
    check('savings goal at 25%', has_text('25%') and has_text('Laptop'))

    # ---- edit + delete an expense
    nav('Expenses'); xp("//button[@aria-label='Edit Food']").click(); dlg = dialog(); fill('Amount', '300', dlg); btn('Save changes', dlg)
    nav('Dashboard'); check('balance = ₹8,200.00 after editing expense to ₹300', wait_balance('₹8,200.00'))
    nav('Expenses'); xp("//button[@aria-label='Delete Food']").click(); btn('Delete expense', dialog())
    check('expense list empty after delete', has_text('No expenses yet'))
    nav('Dashboard'); check('balance restored to ₹8,500.00', wait_balance('₹8,500.00'))
    shot('07-dashboard-filled')

    # ---- transactions page
    nav('Transactions'); check('transactions lists fee payment and loan', has_text('Semester fee payment') and has_text('Lent to Arjun'))
    fld = xp("//input[@aria-label='Search transactions']"); fld.send_keys('arjun'); time.sleep(0.9)
    check('search narrows transactions', has_text('Lent to Arjun') and not has_text('Semester fee payment', 2))
    shot('08-transactions')

    # ---- reports: real downloads
    nav('Reports & Exports'); shot('09-reports')
    for fmt, ext in (('PDF', 'pdf'), ('Excel', 'xlsx'), ('CSV', 'csv')):
        btn(f'Download {fmt}'); check(f'{fmt} download toast', toast(f'{fmt} report downloaded'))
    time.sleep(1.5)
    files = sorted(os.listdir(DL)); log(f'downloaded: {files}')
    for ext in ('pdf', 'xlsx', 'csv'):
        check(f'.{ext} file saved with server filename', any(f.startswith('campusledger-monthly-') and f.endswith('.' + ext) for f in files if not f.endswith('.part')))

    # ---- notifications bell shows export notifications
    xp("//button[contains(@aria-label,'Notifications')]").click()
    check('bell lists export notifications', has_text('Export ready'))
    shot('10-notifications'); d.find_element(By.TAG_NAME, 'body').send_keys(Keys.ESCAPE)

    # ---- settings: theme + toggles + profile
    nav('Settings'); xp("//button[@role='tab' and normalize-space()='Dark']").click(); time.sleep(0.5)
    check('dark theme applied to page', 'dark' in d.find_element(By.TAG_NAME, 'html').get_attribute('class'))
    shot('11-settings-dark'); nav('Dashboard'); time.sleep(1); shot('12-dashboard-dark')
    d.refresh(); time.sleep(1.5); check('dark theme persists after reload', 'dark' in d.find_element(By.TAG_NAME, 'html').get_attribute('class'))
    nav('Settings'); xp("//button[@role='tab' and normalize-space()='Light']").click(); time.sleep(0.4)
    fill('Hostel', "CET Men's Hostel (Block A)"); btn('Save profile'); check('profile saved', toast('Profile saved'))

    # ---- mobile layout
    d.set_window_size(390, 844); d.get(BASE + '/'); time.sleep(1.5)
    check('mobile bottom nav visible', xp("//nav[@aria-label='Main' and contains(@class,'fixed')]").is_displayed())
    check('no horizontal overflow on mobile dashboard', d.execute_script("return document.documentElement.scrollWidth <= window.innerWidth"))
    shot('13-mobile-dashboard')
    xp("//button[@aria-label='Add expense']").click(); shot('14-mobile-quick-add'); dlg = dialog()
    check('mobile sheet fits width', d.execute_script("return arguments[0].getBoundingClientRect().width <= window.innerWidth", dlg))
    d.find_element(By.TAG_NAME, 'body').send_keys(Keys.ESCAPE)
    for path, name in (('/fees', 'fees'), ('/transactions', 'transactions'), ('/borrow-lend', 'lend'), ('/budgets', 'budgets'), ('/reports', 'reports'), ('/settings', 'settings'), ('/expenses', 'expenses'), ('/income', 'income'), ('/savings', 'savings')):
        d.get(BASE + path); time.sleep(1.2)
        ok = d.execute_script("return document.documentElement.scrollWidth <= window.innerWidth")
        check(f'no horizontal overflow on mobile {name}', ok)
        if name in ('fees', 'settings'): shot(f'15-mobile-{name}')
    # sign out from the mobile menu
    d.get(BASE + '/'); time.sleep(1); xp("//button[normalize-space()='More']").click(); btn('Sign out', dialog())
    check('sign out returns to login', has_text('Sign in') and '/login' in d.current_url)
    d.get(BASE + '/expenses'); time.sleep(1); check('protected page redirects after sign out', '/login' in d.current_url)

    # ---- second user sees none of it
    d.set_window_size(1280, 900); d.get(BASE + '/register'); time.sleep(0.8)
    fill('Full name', 'Bob Other'); fill('Email', 'bob@example.com'); fill('Password', 'Passw0rd!x'); fill('Department', 'ECE'); btn('Create account')
    check('second user starts at ₹0.00', has_text('Available balance') and wait_balance('₹0.00'))
    nav('Transactions'); check('second user has no transactions', has_text('No transactions yet'))
    nav('Fees & Payments'); check('second user has no fees', has_text('No fees added yet'))
    e = [x for x in errs() if 'ResizeObserver' not in x]
    check('no console errors or unhandled rejections during the whole run', not e, str(e[:5]))
except Exception as ex:
    log('EXCEPTION: ' + repr(ex)); traceback.print_exc(); shot('zz-failure')
    log('URL: ' + d.current_url); log('errs: ' + str(errs()[:5]))
finally:
    d.quit()
    fails = [n for n, ok in results if not ok]
    log(f'\n{len(results)-len(fails)}/{len(results)} checks passed'); 
    if fails: log('FAILED: ' + '; '.join(fails))
    sys.exit(1 if fails else 0)
