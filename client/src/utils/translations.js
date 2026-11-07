/**
 * UI strings. English is the source of truth; any key missing in Hindi falls
 * back to English. Use `{name}` placeholders for values: t('dash.greeting', { name }).
 *
 * Only worker-facing and frequently used screens are translated. Admin-only
 * screens (catalogue, audit log, reports) stay in English on purpose.
 */
const translations = {
  en: {
    app: { name: 'SimplyAID', tagline: 'First aid compliance' },

    nav: {
      overview: 'Overview', operations: 'Operations', inventoryGroup: 'Inventory', complianceGroup: 'Compliance', administration: 'Administration', account: 'Account',
      dashboard: 'Dashboard', notifications: 'Notifications', reportIncident: 'Report incident', incidents: 'Incidents', reviews: 'Review queue',
      treatments: 'Treatments', qrScan: 'QR scan', kits: 'First aid kits', inventory: 'Inventory', expiry: 'Expiry tracking',
      stockMovements: 'Stock movements', compliance: 'Compliance', inspections: 'Inspections', reports: 'Reports', analytics: 'Analytics',
      people: 'People', departments: 'Departments', scanHistory: 'Scan history', activity: 'Activity log', profile: 'My profile', settings: 'Settings',
      collapse: 'Collapse sidebar', expand: 'Expand sidebar'
    },

    top: {
      search: 'Search kits, items, incidents, people…', setLocation: 'Set location', currentLocation: 'Current location',
      locationHint: 'Used to pre-fill the location and department of incident reports.', clearLocation: 'Clear location',
      noLocations: 'No scanner locations configured.', notifications: 'Notifications', markAllRead: 'Mark all read',
      caughtUp: 'You’re all caught up.', viewAll: 'View all notifications', myProfile: 'My profile', settings: 'Settings',
      signOut: 'Sign out', switchLang: 'हिन्दी में देखें', langShort: 'हिं'
    },

    sos: {
      button: 'SOS', sending: 'Sending…', confirmTitle: 'Send an SOS emergency alert?',
      confirmMsg: 'This immediately creates an emergency incident and alerts your manager, all managers and the medical team.',
      confirmBtn: 'Send SOS', sent: 'SOS sent', failed: 'Could not send SOS — call for help directly.',
      badge: 'SOS', banner: 'SOS emergency', bannerText: '{name} pressed SOS at {location}. Go to them now, then complete the report.',
      fillNow: 'Fill the report', employeeBanner: 'Your SOS was sent. Help is on the way — stay where you are if it is safe.'
    },

    auth: {
      signIn: 'Sign in', createAccount: 'Create account', welcome: 'Good to see you again.', joinSub: 'Join your organisation’s SimplyAID workspace.',
      fullName: 'Full name', email: 'Work email', companyCode: 'Company code', password: 'Password', confirmPassword: 'Confirm password',
      companyHint: 'New accounts start with the employee role. An administrator can change it.',
      showPw: 'Show password', hidePw: 'Hide password',
      errEmail: 'Enter a valid email address', errPassword: 'Enter your password', errName: 'Enter your full name',
      errCompany: 'Ask your administrator for the company code', errPwRule: 'At least 8 characters, with a letter and a number',
      errMismatch: 'Passwords do not match', failedIn: 'Sign in failed', failedUp: 'Could not create the account',
      welcomeBack: 'Welcome back, {name}', accountCreated: 'Account created — welcome to SimplyAID!',
      demoTitle: 'Demo accounts', demoDev: 'Development only', demoHint: 'Sign in instantly as any seeded user. Password for all demo accounts:',
      accounts: '{n} accounts', account: '{n} account',
      heroTitle: 'Every kit stocked.\nEvery injury on record.',
      heroSub: 'The first aid register for factory floors — kits, expiry dates, inspections and incident reports, kept the way the Factories Act asks for them.',
      sheetTitle: 'What gets checked',
      check1: 'Kit contents against the Schedule, item by item', check2: 'Expiry dates, batch by batch', check3: 'Monthly inspections signed off by a named person',
      check4: 'Every injury logged, with Form 18 when it’s reportable', check5: 'SOS straight to the floor manager and the doctor',
      stamp: 'Factories Act 1948 · S.45 & S.88'
    },

    dash: {
      morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', greeting: '{greet}, {name}',
      subEmployee: 'Your workplace safety at a glance.', subDept: 'Here’s the status of {dept}’s first aid kits.', subOrg: 'Here’s the first aid readiness of {org}.',
      refresh: 'Refresh', manageKits: 'Manage kits',
      profileIncomplete: 'Your profile is {pct}% complete', profileWhy: 'First responders rely on your blood group, allergies and emergency contact.', completeProfile: 'Complete profile',
      actReport: 'Report an incident', actReportText: 'Log an injury, illness or near miss',
      actScan: 'Scan a QR code', actScanText: 'Open a kit or a colleague’s emergency card',
      actProfile: 'My profile', actProfileText: 'Keep your medical & emergency details current',
      actMine: 'My incidents', actMineText: 'Track the status of your reports',
      sosTitle: 'In an emergency, press SOS', sosText: 'The red SOS button at the top creates an emergency report and alerts your manager and the medical team immediately.',
      myRecent: 'My recent incidents', viewAll: 'View all', noIncidents: 'No incidents reported', noIncidentsText: 'Stay safe! Anything you report will appear here.',
      latestNotifs: 'Latest notifications', noNotifs: 'No notifications', new: 'New',
      kits: 'First aid kits', kitsMeta: '{n} fully adequate', items: 'Inventory items', itemsMeta: '{n} units across all kits',
      lowStock: 'Low-stock items', lowStockMeta: '{n} kit slots completely empty', expired: 'Expired units', expiredMeta: '{n} batches to remove',
      expiring: 'Expiring ≤ 30 days', expiringMeta: '{n} batches within 7 days', complianceScore: 'Compliance score',
      complianceStatus: 'Compliance status', details: 'Details', needsAttention: 'Needs attention', allAlerts: 'All alerts',
      nothingAttention: 'Nothing needs attention', nothingAttentionText: 'All kits are stocked, in date and inspected.',
      kitStatus: 'Kit status', activeKits: '{n} active kits', stockByDept: 'Stock level by department', stockByDeptSub: 'Share of required units present in each department’s kits',
      byCategory: 'Inventory by category', byCategorySub: 'Units currently in stock', expiryOutlook: 'Expiry outlook', expiryOutlookSub: 'Units expiring in each of the next six months',
      expiryTracking: 'Expiry tracking', expiringSoon: 'Expired & expiring soon', nothingExpiring: 'Nothing expiring in the next 30 days',
      lowStockItems: 'Low-stock items', inventory: 'Inventory', allStocked: 'Every kit meets its required quantities',
      recentActivity: 'Recent activity', activityLog: 'Activity log', noActivity: 'No activity yet', item: 'Item', kit: 'Kit', qty: 'Qty', expiry: 'Expiry',
      adequate: 'Adequate', needsRestock: 'Needs restock', inspectionDue: 'Inspection due', expiredItems: 'Expired items', noKits: 'No active kits yet.',
      openSos: 'Open SOS alerts', openSosText: '{n} employee(s) pressed SOS and are waiting for help.', respond: 'Respond'
    },

    incidents: {
      title: 'Incidents', subtitle: 'Track and manage workplace incidents', new: 'Report incident', id: 'Incident ID', date: 'Date', dateTime: 'Date & time',
      injuredPerson: 'Injured person', department: 'Department', severity: 'Severity', status: 'Status', type: 'Type', location: 'Location',
      description: 'Description', treatment: 'Treatment given', treatedBy: 'Treated by', outcome: 'Outcome', daysLost: 'Days lost',
      rootCause: 'Root cause', correctiveAction: 'Corrective action', preventive: 'Preventive measures', bodyPart: 'Body parts affected', witnesses: 'Witnesses',
      minor: 'Minor', moderate: 'Moderate', serious: 'Serious', fatal: 'Fatal',
      reported: 'Reported', under_investigation: 'Under investigation', resolved: 'Resolved', closed: 'Closed',
      injury: 'Injury', illness: 'Illness', near_miss: 'Near miss', dangerous_occurrence: 'Dangerous occurrence', form18: 'Form 18', reportable: 'Reportable',
      filteredBy: 'Filtered by active location:', page: 'Page {page} of {pages}', all: 'All',
      back: 'Back to incidents', editReport: 'Edit report', editTitle: 'Edit incident report', cancelEdit: 'Cancel editing', saveChanges: 'Save changes',
      investigation: 'Investigation', investigationDetails: 'Investigation details', timeline: 'Status timeline', incidentDetails: 'Incident details',
      treatmentOutcome: 'Treatment & outcome', name: 'Name', employeeId: 'Employee ID', ageGender: 'Age / gender', notRecorded: 'Not recorded',
      notDetermined: 'Not determined yet', pending: 'Pending', hospital: 'Hospital', notFound: 'Incident not found',
      notFoundText: 'It may have been removed, or it belongs to a department you can’t see.', updated: 'Incident updated', updateFailed: 'Update failed',
      fillBanner: 'This incident report is to be filled by you because the employee couldn’t fill it.', goFill: 'Fill it now',
      form18Filed: 'filed', form18Pending: 'pending', genForm18: 'Generate Form 18', dlForm18: 'Download Form 18'
    },

    outcome: {
      pending_confirmation: 'Pending confirmation', returned_to_work: 'Returned to work', sent_home: 'Sent home', hospitalized: 'Hospitalised',
      referred_to_doctor: 'Referred to doctor', under_observation: 'Under observation', fatal: 'Fatal'
    },

    report: {
      subtitle: 'Report a new workplace incident',
      step1: 'Injured person', step2: 'Incident details', step3: 'First aid / medicine', step4: 'Outcome',
      location: 'Location:', noLocation: 'No location selected.', noLocationHint: 'Pick your location from the top bar to fill it in automatically.',
      personTitle: 'Injured person details', fullName: 'Full name', employeeId: 'Employee ID', department: 'Department', select: 'Select',
      age: 'Age', gender: 'Gender', male: 'Male', female: 'Female', other: 'Other', designation: 'Designation', enterName: 'Enter name',
      detailsTitle: 'Incident details', fromScanner: '(from your location)', where: 'Where did it happen?', whatHappened: 'Describe what happened…',
      cause: 'Cause of injury', injuryTypes: 'Injury types', selectAll: '(select all that apply)', selected: 'Selected:', bodyParts: 'Body parts affected',
      witnesses: 'Witnesses (comma separated)', firstAidTitle: 'First aid / medicine',
      firstAidQ: 'Did the injured person use any medicine or first aid items from a kit? A manager or doctor will confirm it and update the stock.',
      usedKit: 'Yes, items were used from a first aid kit', selectKit: 'Select first aid kit', chooseKit: '-- Select a kit --', itemsUsed: 'Items used',
      chooseItem: '-- Select item --', qty: 'Qty', add: 'Add', added: 'Added items:', inKit: 'in kit',
      outcomeTitle: 'Outcome', outcomeQ: 'What is the immediate outcome for the injured person?',
      doctor: 'Send to doctor', doctorText: 'The injured person needs medical attention. The doctor will be notified and will add treatment details.',
      work: 'Back to work', workText: 'The injured person can continue working. The incident will be logged for the record.',
      manager: 'Pending manager confirmation', managerText: 'Not sure? A manager will come to the spot and decide whether you see a doctor or go back to work.',
      managerNote: 'Your manager will be notified and will come to you to assess the situation and decide the next step.',
      doctorNote: 'The doctor will add treatment details, prescriptions and further assessment to this report.',
      reportable: 'This incident is reportable under Section 88', reportableText: 'Form 18 must be generated and sent to the Inspector of Factories.',
      success: 'Incident reported', failed: 'Failed to report incident'
    },

    bodyParts: {
      Head: 'Head', Face: 'Face', Eye: 'Eye', Neck: 'Neck', Shoulder: 'Shoulder', Arm: 'Arm', Hand: 'Hand', Finger: 'Finger', Chest: 'Chest', Back: 'Back',
      Abdomen: 'Abdomen', Hip: 'Hip', Leg: 'Leg', Knee: 'Knee', Foot: 'Foot', Toe: 'Toe', Multiple: 'Multiple'
    },
    injuryTypes: {},

    notif: {
      subtitle: 'Alerts for stock, expiry, compliance, incidents and certifications.', inbox: 'Inbox', unread: 'Unread', archived: 'Archived',
      search: 'Search notifications…', allCategories: 'All categories', anySeverity: 'Any severity', critical: 'Critical', warning: 'Warning', info: 'Info',
      unreadCount: '{n} unread', selected: '{n} selected', markRead: 'Mark read', markUnread: 'Mark unread', delete: 'Delete', clear: 'Clear',
      noArchived: 'No archived notifications', caughtUp: 'You’re all caught up', newHere: 'New alerts will appear here.', selectPage: 'Select page',
      archive: 'Archive', restore: 'Restore', open: 'Open', deleteConfirm: 'Delete {n} notification(s)?', cannotUndo: 'This cannot be undone.'
    },

    review: {
      title: 'Incident review queue', subtitle: 'Confirm reports from your department and complete them on-site when employees need help.',
      pending: '{n} pending', total30: 'Total incidents (30d)', openCases: 'Open cases', daysLost30: 'Days lost (30d)',
      pendingTab: 'Pending actions', historyTab: 'Confirmed & history', allClear: 'All clear!', allClearText: 'No pending incidents need your attention.',
      needsHelp: 'Needs your help — the employee couldn’t fill the report', urgent: '{n} urgent',
      assistBanner: 'The employee couldn’t fill this report — go to them and complete it below.', view: 'View', fill: 'Fill report', closeForm: 'Close form',
      sosTitle: 'SOS — employee needs help right now'
    },

    settings: {
      title: 'Settings', subtitle: 'Your account, security and display preferences.', account: 'Account', name: 'Name', email: 'Email', role: 'Role',
      department: 'Department', company: 'Company', lastSignIn: 'Last sign-in', language: 'Language / भाषा', languageSub: 'Changes menus, dashboards and incident forms.',
      changePw: 'Change password', changePwSub: 'Changing your password signs you out on every other device.', currentPw: 'Current password',
      newPw: 'New password', confirmPw: 'Confirm new password', pwHint: 'At least 8 characters, including a letter and a number.',
      show: 'Show passwords', hide: 'Hide passwords', update: 'Update password'
    },

    employee: { profile: 'Employee profile', idCard: 'ID card', downloadQr: 'Download QR', regenerateQr: 'Regenerate QR', downloadCard: 'Download card', printCard: 'Print card', viewCard: 'View ID card', viewProfile: 'View profile', personalInfo: 'Personal information', orgInfo: 'Organisation information', safetyInfo: 'Safety information', emergencyContact: 'Emergency contact', firstAidInfo: 'First aid information', qrInfo: 'QR information', scanHistory: 'Scan history', lastScan: 'Last scan', noScans: 'No scans recorded', editProfile: 'Edit profile', status: { active: 'Active', on_leave: 'On leave', suspended: 'Suspended', resigned: 'Resigned' } },

    labels: {},

    time: { justNow: 'just now', min: '{n} min ago', h: '{n} h ago', d: '{n} d ago' },

    common: {
      save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', view: 'View', search: 'Search…', filter: 'Filter', export: 'Export',
      loading: 'Loading…', noData: 'No data found', confirm: 'Confirm', actions: 'Actions', all: 'All', back: 'Back', next: 'Next',
      submit: 'Submit', close: 'Close', tryAgain: 'Try again', somethingWrong: 'Something went wrong', showing: 'Showing {from}–{to} of {total}',
      pageOf: 'Page {page} of {pages}'
    }
  },

  hi: {
    app: { name: 'SimplyAID', tagline: 'प्राथमिक चिकित्सा अनुपालन' },

    nav: {
      overview: 'सारांश', operations: 'कार्य', inventoryGroup: 'भंडार', complianceGroup: 'अनुपालन', administration: 'प्रशासन', account: 'खाता',
      dashboard: 'डैशबोर्ड', notifications: 'सूचनाएँ', reportIncident: 'घटना दर्ज करें', incidents: 'घटनाएँ', reviews: 'समीक्षा सूची',
      treatments: 'उपचार', qrScan: 'QR स्कैन', kits: 'प्राथमिक चिकित्सा किट', inventory: 'भंडार', expiry: 'समाप्ति ट्रैकिंग',
      stockMovements: 'स्टॉक आवाजाही', compliance: 'अनुपालन', inspections: 'निरीक्षण', reports: 'रिपोर्ट', analytics: 'विश्लेषण',
      people: 'कर्मचारी', departments: 'विभाग', scanHistory: 'स्कैन इतिहास', activity: 'गतिविधि लॉग', profile: 'मेरी प्रोफ़ाइल', settings: 'सेटिंग्स',
      collapse: 'साइडबार छोटा करें', expand: 'साइडबार बड़ा करें'
    },

    top: {
      search: 'किट, सामान, घटनाएँ, लोग खोजें…', setLocation: 'स्थान चुनें', currentLocation: 'वर्तमान स्थान',
      locationHint: 'घटना रिपोर्ट में स्थान और विभाग अपने-आप भरने के लिए।', clearLocation: 'स्थान हटाएँ',
      noLocations: 'कोई स्कैनर स्थान नहीं बना है।', notifications: 'सूचनाएँ', markAllRead: 'सब पढ़ा हुआ करें',
      caughtUp: 'कोई नई सूचना नहीं।', viewAll: 'सभी सूचनाएँ देखें', myProfile: 'मेरी प्रोफ़ाइल', settings: 'सेटिंग्स',
      signOut: 'साइन आउट', switchLang: 'View in English', langShort: 'EN'
    },

    sos: {
      button: 'SOS', sending: 'भेज रहे हैं…', confirmTitle: 'SOS आपातकालीन अलर्ट भेजें?',
      confirmMsg: 'इससे तुरंत एक आपातकालीन घटना बनेगी और आपके मैनेजर, सभी मैनेजरों और मेडिकल टीम को सूचना जाएगी।',
      confirmBtn: 'SOS भेजें', sent: 'SOS भेज दिया गया', failed: 'SOS नहीं भेजा जा सका — सीधे मदद के लिए आवाज़ लगाएँ।',
      badge: 'SOS', banner: 'SOS आपातकाल', bannerText: '{name} ने {location} पर SOS दबाया है। तुरंत उनके पास जाएँ, फिर रिपोर्ट भरें।',
      fillNow: 'रिपोर्ट भरें', employeeBanner: 'आपका SOS भेज दिया गया है। मदद आ रही है — सुरक्षित हो तो वहीं रहें।'
    },

    auth: {
      signIn: 'साइन इन', createAccount: 'खाता बनाएँ', welcome: 'आपका फिर से स्वागत है।', joinSub: 'अपने संगठन के SimplyAID से जुड़ें।',
      fullName: 'पूरा नाम', email: 'ऑफ़िस ईमेल', companyCode: 'कंपनी कोड', password: 'पासवर्ड', confirmPassword: 'पासवर्ड दोबारा लिखें',
      companyHint: 'नया खाता कर्मचारी भूमिका से शुरू होता है। एडमिन इसे बदल सकते हैं।',
      showPw: 'पासवर्ड दिखाएँ', hidePw: 'पासवर्ड छिपाएँ',
      errEmail: 'सही ईमेल पता लिखें', errPassword: 'पासवर्ड लिखें', errName: 'पूरा नाम लिखें',
      errCompany: 'कंपनी कोड के लिए अपने एडमिन से पूछें', errPwRule: 'कम से कम 8 अक्षर, जिनमें एक अक्षर और एक अंक हो',
      errMismatch: 'पासवर्ड मेल नहीं खाते', failedIn: 'साइन इन नहीं हो सका', failedUp: 'खाता नहीं बन सका',
      welcomeBack: 'स्वागत है, {name}', accountCreated: 'खाता बन गया — SimplyAID में स्वागत है!',
      demoTitle: 'डेमो खाते', demoDev: 'केवल डेवलपमेंट', demoHint: 'किसी भी डेमो उपयोगकर्ता से सीधे साइन इन करें। सभी का पासवर्ड:',
      accounts: '{n} खाते', account: '{n} खाता',
      heroTitle: 'हर किट पूरी।\nहर चोट दर्ज।',
      heroSub: 'फ़ैक्टरी के लिए प्राथमिक चिकित्सा रजिस्टर — किट, समाप्ति तिथि, निरीक्षण और घटना रिपोर्ट, कारख़ाना अधिनियम के अनुसार।',
      sheetTitle: 'क्या-क्या जाँचा जाता है',
      check1: 'किट का हर सामान, अनुसूची के अनुसार', check2: 'हर बैच की समाप्ति तिथि', check3: 'हर महीने निरीक्षण, ज़िम्मेदार व्यक्ति के हस्ताक्षर के साथ',
      check4: 'हर चोट दर्ज, ज़रूरत हो तो फ़ॉर्म 18 के साथ', check5: 'SOS सीधे फ़्लोर मैनेजर और डॉक्टर तक',
      stamp: 'कारख़ाना अधिनियम 1948 · धारा 45 व 88'
    },

    dash: {
      morning: 'सुप्रभात', afternoon: 'नमस्ते', evening: 'शुभ संध्या', greeting: '{greet}, {name}',
      subEmployee: 'आपकी कार्यस्थल सुरक्षा एक नज़र में।', subDept: '{dept} की प्राथमिक चिकित्सा किटों की स्थिति।', subOrg: '{org} की प्राथमिक चिकित्सा तैयारी।',
      refresh: 'रीफ़्रेश', manageKits: 'किट प्रबंधन',
      profileIncomplete: 'आपकी प्रोफ़ाइल {pct}% पूरी है', profileWhy: 'आपात स्थिति में मदद करने वाले आपके ब्लड ग्रुप, एलर्जी और आपातकालीन संपर्क पर निर्भर रहते हैं।', completeProfile: 'प्रोफ़ाइल पूरी करें',
      actReport: 'घटना दर्ज करें', actReportText: 'चोट, बीमारी या बाल-बाल बचने की घटना लिखें',
      actScan: 'QR कोड स्कैन करें', actScanText: 'किट या किसी साथी का आपातकालीन कार्ड खोलें',
      actProfile: 'मेरी प्रोफ़ाइल', actProfileText: 'अपनी मेडिकल और आपातकालीन जानकारी अपडेट रखें',
      actMine: 'मेरी घटनाएँ', actMineText: 'अपनी रिपोर्ट की स्थिति देखें',
      sosTitle: 'आपात स्थिति में SOS दबाएँ', sosText: 'ऊपर लाल SOS बटन दबाते ही आपातकालीन रिपोर्ट बनती है और आपके मैनेजर व मेडिकल टीम को तुरंत सूचना जाती है।',
      myRecent: 'मेरी हाल की घटनाएँ', viewAll: 'सभी देखें', noIncidents: 'कोई घटना दर्ज नहीं', noIncidentsText: 'सुरक्षित रहें! आपकी रिपोर्ट यहाँ दिखेंगी।',
      latestNotifs: 'नई सूचनाएँ', noNotifs: 'कोई सूचना नहीं', new: 'नया',
      kits: 'प्राथमिक चिकित्सा किट', kitsMeta: '{n} पूरी तरह पर्याप्त', items: 'भंडार सामान', itemsMeta: 'सभी किटों में {n} यूनिट',
      lowStock: 'कम स्टॉक वाले सामान', lowStockMeta: '{n} किट खाने पूरी तरह खाली', expired: 'एक्सपायर यूनिट', expiredMeta: '{n} बैच हटाने हैं',
      expiring: '30 दिन में एक्सपायर', expiringMeta: '{n} बैच 7 दिन में', complianceScore: 'अनुपालन स्कोर',
      complianceStatus: 'अनुपालन स्थिति', details: 'विवरण', needsAttention: 'ध्यान दें', allAlerts: 'सभी अलर्ट',
      nothingAttention: 'सब ठीक है', nothingAttentionText: 'सभी किट भरी हुई, समय-सीमा में और जाँची हुई हैं।',
      kitStatus: 'किट की स्थिति', activeKits: '{n} सक्रिय किट', stockByDept: 'विभाग अनुसार स्टॉक', stockByDeptSub: 'हर विभाग की किटों में ज़रूरी यूनिट में से कितनी मौजूद हैं',
      byCategory: 'श्रेणी अनुसार भंडार', byCategorySub: 'अभी स्टॉक में यूनिट', expiryOutlook: 'आगामी समाप्ति', expiryOutlookSub: 'अगले छह महीनों में हर महीने एक्सपायर होने वाली यूनिट',
      expiryTracking: 'समाप्ति ट्रैकिंग', expiringSoon: 'एक्सपायर और जल्द एक्सपायर', nothingExpiring: 'अगले 30 दिनों में कुछ एक्सपायर नहीं हो रहा',
      lowStockItems: 'कम स्टॉक वाले सामान', inventory: 'भंडार', allStocked: 'हर किट में ज़रूरी मात्रा मौजूद है',
      recentActivity: 'हाल की गतिविधि', activityLog: 'गतिविधि लॉग', noActivity: 'अभी कोई गतिविधि नहीं', item: 'सामान', kit: 'किट', qty: 'मात्रा', expiry: 'समाप्ति',
      adequate: 'पर्याप्त', needsRestock: 'भरना ज़रूरी', inspectionDue: 'निरीक्षण बाकी', expiredItems: 'एक्सपायर सामान', noKits: 'अभी कोई सक्रिय किट नहीं।',
      openSos: 'खुले SOS अलर्ट', openSosText: '{n} कर्मचारी ने SOS दबाया है और मदद का इंतज़ार कर रहे हैं।', respond: 'जवाब दें'
    },

    incidents: {
      title: 'घटनाएँ', subtitle: 'कार्यस्थल की घटनाएँ देखें और संभालें', new: 'घटना दर्ज करें', id: 'घटना ID', date: 'तारीख', dateTime: 'तारीख और समय',
      injuredPerson: 'घायल व्यक्ति', department: 'विभाग', severity: 'गंभीरता', status: 'स्थिति', type: 'प्रकार', location: 'स्थान',
      description: 'विवरण', treatment: 'दिया गया उपचार', treatedBy: 'उपचार करने वाले', outcome: 'परिणाम', daysLost: 'खोए दिन',
      rootCause: 'मूल कारण', correctiveAction: 'सुधारात्मक कार्रवाई', preventive: 'रोकथाम के उपाय', bodyPart: 'प्रभावित अंग', witnesses: 'गवाह',
      minor: 'मामूली', moderate: 'मध्यम', serious: 'गंभीर', fatal: 'घातक',
      reported: 'दर्ज', under_investigation: 'जाँच जारी', resolved: 'हल', closed: 'बंद',
      injury: 'चोट', illness: 'बीमारी', near_miss: 'बाल-बाल बचे', dangerous_occurrence: 'खतरनाक घटना', form18: 'फ़ॉर्म 18', reportable: 'रिपोर्ट योग्य',
      filteredBy: 'चुने गए स्थान के अनुसार:', page: 'पेज {page} / {pages}', all: 'सभी',
      back: 'घटनाओं पर वापस', editReport: 'रिपोर्ट बदलें', editTitle: 'घटना रिपोर्ट बदलें', cancelEdit: 'बदलाव रद्द करें', saveChanges: 'बदलाव सहेजें',
      investigation: 'जाँच', investigationDetails: 'जाँच का विवरण', timeline: 'स्थिति का क्रम', incidentDetails: 'घटना का विवरण',
      treatmentOutcome: 'उपचार और परिणाम', name: 'नाम', employeeId: 'कर्मचारी ID', ageGender: 'उम्र / लिंग', notRecorded: 'दर्ज नहीं',
      notDetermined: 'अभी तय नहीं', pending: 'बाकी', hospital: 'अस्पताल', notFound: 'घटना नहीं मिली',
      notFoundText: 'हो सकता है इसे हटा दिया गया हो, या यह किसी ऐसे विभाग की है जिसे आप नहीं देख सकते।', updated: 'घटना अपडेट हो गई', updateFailed: 'अपडेट नहीं हो सका',
      fillBanner: 'यह घटना रिपोर्ट आपको भरनी है क्योंकि कर्मचारी इसे नहीं भर सके।', goFill: 'अभी भरें',
      form18Filed: 'जमा', form18Pending: 'बाकी', genForm18: 'फ़ॉर्म 18 बनाएँ', dlForm18: 'फ़ॉर्म 18 डाउनलोड करें'
    },

    outcome: {
      pending_confirmation: 'पुष्टि बाकी', returned_to_work: 'काम पर लौटे', sent_home: 'घर भेजा गया', hospitalized: 'अस्पताल में भर्ती',
      referred_to_doctor: 'डॉक्टर के पास भेजा', under_observation: 'निगरानी में', fatal: 'घातक'
    },

    report: {
      subtitle: 'कार्यस्थल की नई घटना दर्ज करें',
      step1: 'घायल व्यक्ति', step2: 'घटना का विवरण', step3: 'प्राथमिक चिकित्सा / दवा', step4: 'परिणाम',
      location: 'स्थान:', noLocation: 'कोई स्थान नहीं चुना गया।', noLocationHint: 'स्थान अपने-आप भरने के लिए ऊपर की पट्टी से अपना स्थान चुनें।',
      personTitle: 'घायल व्यक्ति की जानकारी', fullName: 'पूरा नाम', employeeId: 'कर्मचारी ID', department: 'विभाग', select: 'चुनें',
      age: 'उम्र', gender: 'लिंग', male: 'पुरुष', female: 'महिला', other: 'अन्य', designation: 'पद', enterName: 'नाम लिखें',
      detailsTitle: 'घटना का विवरण', fromScanner: '(आपके स्थान से)', where: 'घटना कहाँ हुई?', whatHappened: 'बताएँ क्या हुआ…',
      cause: 'चोट का कारण', injuryTypes: 'चोट के प्रकार', selectAll: '(जो लागू हों सब चुनें)', selected: 'चुने गए:', bodyParts: 'प्रभावित अंग',
      witnesses: 'गवाह (कॉमा से अलग करें)', firstAidTitle: 'प्राथमिक चिकित्सा / दवा',
      firstAidQ: 'क्या घायल व्यक्ति ने किट से कोई दवा या सामान लिया? मैनेजर या डॉक्टर इसकी पुष्टि करके स्टॉक अपडेट करेंगे।',
      usedKit: 'हाँ, प्राथमिक चिकित्सा किट से सामान लिया गया', selectKit: 'प्राथमिक चिकित्सा किट चुनें', chooseKit: '-- किट चुनें --', itemsUsed: 'इस्तेमाल किया गया सामान',
      chooseItem: '-- सामान चुनें --', qty: 'मात्रा', add: 'जोड़ें', added: 'जोड़ा गया सामान:', inKit: 'किट में',
      outcomeTitle: 'परिणाम', outcomeQ: 'घायल व्यक्ति के लिए अभी क्या करना है?',
      doctor: 'डॉक्टर के पास भेजें', doctorText: 'घायल व्यक्ति को इलाज चाहिए। डॉक्टर को सूचना जाएगी और वे उपचार की जानकारी जोड़ेंगे।',
      work: 'काम पर वापस', workText: 'घायल व्यक्ति काम जारी रख सकते हैं। घटना रिकॉर्ड के लिए दर्ज रहेगी।',
      manager: 'मैनेजर की पुष्टि बाकी', managerText: 'पक्का नहीं पता? मैनेजर मौके पर आकर तय करेंगे कि डॉक्टर के पास जाना है या काम पर लौटना है।',
      managerNote: 'आपके मैनेजर को सूचना जाएगी और वे आपके पास आकर अगला कदम तय करेंगे।',
      doctorNote: 'डॉक्टर इस रिपोर्ट में उपचार, दवा और आगे की जाँच जोड़ेंगे।',
      reportable: 'यह घटना धारा 88 के तहत रिपोर्ट करनी होगी', reportableText: 'फ़ॉर्म 18 बनाकर कारख़ाना निरीक्षक को भेजना होगा।',
      success: 'घटना दर्ज हो गई', failed: 'घटना दर्ज नहीं हो सकी'
    },

    bodyParts: {
      Head: 'सिर', Face: 'चेहरा', Eye: 'आँख', Neck: 'गर्दन', Shoulder: 'कंधा', Arm: 'बाँह', Hand: 'हाथ', Finger: 'उँगली', Chest: 'छाती', Back: 'पीठ',
      Abdomen: 'पेट', Hip: 'कूल्हा', Leg: 'पैर', Knee: 'घुटना', Foot: 'पंजा', Toe: 'पैर की उँगली', Multiple: 'कई अंग'
    },
    injuryTypes: {
      'Cut / Laceration': 'कटना / घाव', Burn: 'जलना', Fracture: 'हड्डी टूटना', 'Sprain / Strain': 'मोच / खिंचाव', 'Chemical Exposure': 'रसायन का संपर्क',
      'Electric Shock': 'बिजली का झटका', 'Eye Injury': 'आँख में चोट', 'Crush Injury': 'दबने से चोट', Abrasion: 'खरोंच', 'Puncture Wound': 'चुभने का घाव',
      Dislocation: 'जोड़ खिसकना', Concussion: 'सिर में अंदरूनी चोट', Amputation: 'अंग कटना', 'Hearing Loss': 'सुनने में कमी', 'Respiratory Issue': 'साँस की तकलीफ़'
    },

    notif: {
      subtitle: 'स्टॉक, समाप्ति, अनुपालन, घटनाओं और प्रमाणपत्रों के अलर्ट।', inbox: 'इनबॉक्स', unread: 'अपठित', archived: 'संग्रहित',
      search: 'सूचनाएँ खोजें…', allCategories: 'सभी श्रेणियाँ', anySeverity: 'कोई भी गंभीरता', critical: 'गंभीर', warning: 'चेतावनी', info: 'जानकारी',
      unreadCount: '{n} अपठित', selected: '{n} चुनी गईं', markRead: 'पढ़ा हुआ करें', markUnread: 'अपठित करें', delete: 'हटाएँ', clear: 'साफ़ करें',
      noArchived: 'कोई संग्रहित सूचना नहीं', caughtUp: 'कोई नई सूचना नहीं', newHere: 'नए अलर्ट यहाँ दिखेंगे।', selectPage: 'पूरा पेज चुनें',
      archive: 'संग्रहित करें', restore: 'वापस लाएँ', open: 'खोलें', deleteConfirm: '{n} सूचना(एँ) हटाएँ?', cannotUndo: 'यह वापस नहीं होगा।'
    },

    review: {
      title: 'घटना समीक्षा सूची', subtitle: 'अपने विभाग की रिपोर्ट की पुष्टि करें, और कर्मचारी को मदद चाहिए तो मौके पर रिपोर्ट भरें।',
      pending: '{n} बाकी', total30: 'कुल घटनाएँ (30 दिन)', openCases: 'खुले मामले', daysLost30: 'खोए दिन (30 दिन)',
      pendingTab: 'बाकी काम', historyTab: 'पुष्टि हो चुकी और इतिहास', allClear: 'सब ठीक है!', allClearText: 'अभी आपके ध्यान के लिए कोई घटना बाकी नहीं।',
      needsHelp: 'आपकी मदद चाहिए — कर्मचारी रिपोर्ट नहीं भर सके', urgent: '{n} ज़रूरी',
      assistBanner: 'कर्मचारी यह रिपोर्ट नहीं भर सके — उनके पास जाएँ और नीचे रिपोर्ट पूरी करें।', view: 'देखें', fill: 'रिपोर्ट भरें', closeForm: 'फ़ॉर्म बंद करें',
      sosTitle: 'SOS — कर्मचारी को अभी मदद चाहिए'
    },

    settings: {
      title: 'सेटिंग्स', subtitle: 'आपका खाता, सुरक्षा और भाषा।', account: 'खाता', name: 'नाम', email: 'ईमेल', role: 'भूमिका',
      department: 'विभाग', company: 'कंपनी', lastSignIn: 'पिछला साइन इन', language: 'Language / भाषा', languageSub: 'मेनू, डैशबोर्ड और घटना फ़ॉर्म की भाषा बदलता है।',
      changePw: 'पासवर्ड बदलें', changePwSub: 'पासवर्ड बदलने पर बाकी सभी डिवाइस से साइन आउट हो जाएगा।', currentPw: 'मौजूदा पासवर्ड',
      newPw: 'नया पासवर्ड', confirmPw: 'नया पासवर्ड दोबारा लिखें', pwHint: 'कम से कम 8 अक्षर, जिनमें एक अक्षर और एक अंक हो।',
      show: 'पासवर्ड दिखाएँ', hide: 'पासवर्ड छिपाएँ', update: 'पासवर्ड अपडेट करें'
    },

    employee: { profile: 'कर्मचारी प्रोफ़ाइल', idCard: 'आईडी कार्ड', downloadQr: 'QR डाउनलोड करें', regenerateQr: 'नया QR बनाएँ', downloadCard: 'कार्ड डाउनलोड करें', printCard: 'कार्ड प्रिंट करें', viewCard: 'आईडी कार्ड देखें', viewProfile: 'प्रोफ़ाइल देखें', personalInfo: 'व्यक्तिगत जानकारी', orgInfo: 'संगठन की जानकारी', safetyInfo: 'सुरक्षा जानकारी', emergencyContact: 'आपातकालीन संपर्क', firstAidInfo: 'प्राथमिक चिकित्सा जानकारी', qrInfo: 'QR जानकारी', scanHistory: 'स्कैन इतिहास', lastScan: 'पिछला स्कैन', noScans: 'कोई स्कैन दर्ज नहीं', editProfile: 'प्रोफ़ाइल बदलें', status: { active: 'सक्रिय', on_leave: 'छुट्टी पर', suspended: 'निलंबित', resigned: 'इस्तीफ़ा' } },

    // Hindi labels for status values shown through labelize()/StatusBadge
    labels: {
      adequate: 'पर्याप्त', needs_replenishment: 'भरना ज़रूरी', items_expired: 'सामान एक्सपायर', overdue_inspection: 'निरीक्षण बाकी',
      compliant: 'अनुपालन में', at_risk: 'जोखिम में', non_compliant: 'अनुपालन नहीं', in_stock: 'स्टॉक में', low_stock: 'कम स्टॉक', out_of_stock: 'स्टॉक खत्म',
      expired: 'एक्सपायर', expiring: 'जल्द एक्सपायर', critical: 'गंभीर', warning: 'चेतावनी', info: 'जानकारी', ok: 'ठीक',
      reported: 'दर्ज', under_investigation: 'जाँच जारी', resolved: 'हल', closed: 'बंद',
      minor: 'मामूली', moderate: 'मध्यम', serious: 'गंभीर', fatal: 'घातक', injury: 'चोट', illness: 'बीमारी', near_miss: 'बाल-बाल बचे',
      pending_confirmation: 'पुष्टि बाकी', returned_to_work: 'काम पर लौटे', sent_home: 'घर भेजा गया', hospitalized: 'अस्पताल में भर्ती',
      referred_to_doctor: 'डॉक्टर के पास भेजा', under_observation: 'निगरानी में',
      admin: 'एडमिन', doctor: 'डॉक्टर', manager: 'मैनेजर', employee: 'कर्मचारी', active: 'सक्रिय', inactive: 'निष्क्रिय',
      incident: 'घटना', inventory: 'भंडार', expiry: 'समाप्ति', compliance: 'अनुपालन', certification: 'प्रमाणपत्र', treatment: 'उपचार', system: 'सिस्टम'
    },

    time: { justNow: 'अभी', min: '{n} मिनट पहले', h: '{n} घंटे पहले', d: '{n} दिन पहले' },

    common: {
      save: 'सहेजें', cancel: 'रद्द करें', delete: 'हटाएँ', edit: 'बदलें', view: 'देखें', search: 'खोजें…', filter: 'फ़िल्टर', export: 'निर्यात',
      loading: 'लोड हो रहा है…', noData: 'कोई डेटा नहीं मिला', confirm: 'पुष्टि करें', actions: 'कार्रवाई', all: 'सभी', back: 'पीछे', next: 'आगे',
      submit: 'जमा करें', close: 'बंद करें', tryAgain: 'फिर कोशिश करें', somethingWrong: 'कुछ गड़बड़ हो गई', showing: '{total} में से {from}–{to}',
      pageOf: 'पेज {page} / {pages}'
    }
  }
};

export default translations;
