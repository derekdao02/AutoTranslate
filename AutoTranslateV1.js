(function () {
    'use strict';

    /* =====================================================================
     * TBRAIN AUTO-FILL & AUTO-FETCH – MASTER SCRIPT (NO TOOL IN ACTIVITY)
     * ===================================================================== */

    // ==================== CONFIG: AUTO-FETCH ====================
    const EXCLUDED_TASK_IDS = new Set([
        "capture_robocap_20261016_073800_session6_46046fc58c4419ea",
        "capture_robocap_20261016_012832_session2_46046fc58c4419ea"
    ]);

    const PROJECT_ID = "cfbe006a-9012-41bc-ba3c-afa8a3338139";

    let POLL_INTERVAL = 2000;
    let MIN_DURATION_SECONDS = 7200;

    const TOKEN_RETRY_INTERVAL = 60000;
    const API_BASE = "https://api.tbrain.ai";
    const API_URL = `${API_BASE}/api/v1/tasks/pool?projectId=${PROJECT_ID}&page=1&pageSize=20`;

    const CLICK_URL = "https://beacon.tbrain.ai";
    const REQUEST_TIMEOUT = 5000;
    const NOTIFY_ON_FIRST_POLL = true;
    const MAX_SEEN_IDS = 5000;
    const AUTO_ACQUIRE = true;
    const PERF_LOG = true;

    const RATE_LIMIT_RESERVE = 30;
    const MIN_SAFE_POLL_INTERVAL = 2500;
    const MAX_SAFE_POLL_INTERVAL = 15000;
    const RATE_LIMIT_FALLBACK_WAIT = 30000;
    const RATE_LIMIT_SAFETY_MS = 1000;
    const MAX_CONCURRENT_ACQUIRE = 2;

    // ==================== CONFIG: AUTO-FILL ====================
    const CONFIG = {
        panelId: 'tb-helper-panel',
        segmentSelector: '',
        copyRequiresAllFields: true,
        activitySeparator: '_',
        maxObjectWords: 2,
        minL3Score: 18,
        delayBetweenEpisodes: 50,

        selectors: {
            description: [
                'textarea[data-testid="label-task-description"]',
                'textarea[name*="description" i]',
                'textarea[id*="description" i]'
            ],
            activity: [
                'input[data-testid*="activity" i]',
                'input[name*="activity" i]',
                'input[id*="activity" i]',
                'input[placeholder*="activity" i]'
            ],
            skillGroup: [
                'input[data-testid*="skill" i]',
                'input[name*="skill" i]',
                'input[id*="skill" i]',
                'input[placeholder*="skill" i]'
            ],
            scene: [
                'input[data-testid*="scene" i]',
                'input[data-testid*="environment" i]',
                'input[name*="scene" i]',
                'input[id*="scene" i]',
                'input[placeholder*="scene" i]',
                'input[placeholder*="environment" i]'
            ]
        }
    };

    /* ---------------------------------------------------------------------
     * SKILL GROUPS
     * --------------------------------------------------------------------- */
    const SKILL_GROUPS = [
        {
            name: 'Pick and Place / Object Handling', priority: 1, level: 'Easy',
            verbs: ['pick', 'pick up', 'place', 'put', 'move', 'carry', 'lift', 'transfer', 'lay', 'set', 'take', 'grab', 'hold', 'drop', 'load', 'unload', 'push', 'pull', 'flip', 'turn', 'position', 'remove', 'collect', 'gather', 'retrieve'],
            objects: []
        },
        {
            name: 'Tool Use & Technical Manipulation', priority: 2, level: 'Medium',
            verbs: ['saw', 'drill', 'sand', 'cut', 'hammer', 'carve', 'chisel', 'grind', 'weld', 'file', 'plane', 'sharpen', 'measure', 'mark', 'shape', 'trim', 'clamp', 'bend', 'punch', 'engrave', 'rout', 'stamp', 'polish'],
            objects: ['saw', 'table saw', 'drill', 'sander', 'sandpaper', 'hammer', 'chisel', 'grinder', 'welder', 'file', 'plane', 'clamp', 'wrench', 'screwdriver', 'pliers', 'tape measure', 'ruler', 'utility knife', 'router', 'lathe', 'vise', 'wood', 'metal', 'leather', 'board', 'plank']
        },
        {
            name: 'Food Preparation & Cooking', priority: 3, level: 'Easy',
            verbs: ['cook', 'chop', 'slice', 'dice', 'mince', 'peel', 'cut', 'fry', 'boil', 'bake', 'grill', 'knead', 'mix', 'stir', 'whisk', 'season', 'marinate', 'brew', 'roll', 'blend', 'steam', 'grate', 'plate', 'garnish', 'pour'],
            objects: ['food', 'vegetable', 'fruit', 'meat', 'chicken', 'fish', 'egg', 'onion', 'garlic', 'potato', 'carrot', 'tomato', 'dough', 'flour', 'rice', 'noodle', 'sauce', 'soup', 'bread', 'cake', 'pastry', 'coffee', 'tea', 'ingredient', 'cutting board', 'knife', 'wok', 'stove', 'batter', 'pizza', 'salad', 'spring roll'],
            requireObject: true
        },
        {
            name: 'Mechanical / Automotive Work', priority: 4, level: 'Medium',
            verbs: ['remove', 'install', 'replace', 'tighten', 'loosen', 'inspect', 'change', 'rotate', 'jack', 'drain', 'inflate', 'torque', 'adjust', 'check', 'repair', 'fix', 'service', 'maintain'],
            objects: ['car', 'vehicle', 'engine', 'tire', 'tyre', 'wheel', 'wheel bolt', 'lug nut', 'brake', 'oil', 'motorcycle', 'motorbike', 'scooter', 'bicycle', 'bike', 'chain', 'gear', 'axle', 'bearing', 'piston', 'spark plug', 'radiator', 'exhaust', 'carburetor', 'suspension', 'jack'],
            requireObject: true
        },
        {
            name: 'Repair & Maintenance', priority: 5, level: 'Medium',
            verbs: ['repair', 'fix', 'mend', 'patch', 'maintain', 'service', 'lubricate', 'oil', 'restore', 'refurbish', 'reupholster', 'unclog', 'replace'],
            objects: ['broken', 'damaged', 'leak', 'crack', 'hinge', 'faucet', 'pipe', 'shoe', 'watch', 'zipper', 'furniture', 'appliance', 'lock']
        },
        {
            name: 'Assembly & Installation', priority: 6, level: 'Medium',
            verbs: ['assemble', 'install', 'attach', 'mount', 'fit', 'fasten', 'connect', 'put together', 'screw', 'bolt', 'insert', 'join', 'glue', 'hang'],
            objects: ['part', 'component', 'frame', 'panel', 'bracket', 'shelf unit', 'furniture', 'ikea', 'leg', 'module', 'fixture', 'screw', 'bolt']
        },
        {
            name: 'Construction & Building', priority: 7, level: 'Hard',
            verbs: ['lay', 'build', 'construct', 'plaster', 'pour', 'frame', 'tile', 'grout', 'render', 'erect', 'demolish', 'level', 'paint'],
            objects: ['brick', 'wall', 'concrete', 'cement', 'mortar', 'drywall', 'tile', 'beam', 'scaffold', 'roof', 'foundation', 'rebar', 'trowel', 'construction', 'structure', 'formwork']
        },
        {
            name: 'Cleaning & Sanitation', priority: 8, level: 'Easy',
            verbs: ['clean', 'wipe', 'sweep', 'mop', 'scrub', 'vacuum', 'dust', 'sanitize', 'disinfect', 'polish', 'rinse', 'wash', 'spray'],
            objects: ['floor', 'surface', 'counter', 'window', 'toilet', 'sink', 'mirror', 'cloth', 'rag', 'sponge', 'broom', 'mop', 'trash', 'garbage', 'dust', 'stain']
        },
        {
            name: 'Organization & Tidying', priority: 9, level: 'Easy',
            verbs: ['arrange', 'organize', 'organise', 'tidy', 'sort', 'align', 'straighten', 'declutter', 'group', 'rearrange', 'order', 'categorize', 'line up', 'neaten'],
            objects: ['drawer', 'closet', 'wardrobe', 'cabinet', 'desk', 'bookshelf', 'toy', 'book', 'tool rack']
        },
        {
            name: 'Packing & Bagging', priority: 10, level: 'Easy',
            verbs: ['pack', 'bag', 'box', 'wrap', 'seal', 'tape', 'package', 'bundle', 'fill', 'insert'],
            objects: ['bag', 'box', 'carton', 'parcel', 'package', 'packaging', 'bubble wrap', 'tape', 'envelope', 'container', 'plastic bag', 'shipping']
        },
        {
            name: 'Clothing & Laundry', priority: 11, level: 'Easy',
            verbs: ['fold', 'iron', 'hang', 'sew', 'stitch', 'press', 'launder', 'mend', 'hem', 'button'],
            objects: ['clothes', 'clothing', 'shirt', 'tshirt', 'pant', 'pants', 'trouser', 'jean', 'dress', 'towel', 'sock', 'laundry', 'garment', 'fabric', 'sheet', 'blanket', 'jacket', 'hanger', 'sewing machine', 'needle', 'thread', 'textile']
        },
        {
            name: 'Inventory & Stock Management', priority: 12, level: 'Easy',
            verbs: ['stock', 'restock', 'shelve', 'count', 'inventory', 'label', 'tag', 'price', 'replenish', 'face', 'record', 'check stock', 'audit'],
            objects: ['shelf', 'stock', 'inventory', 'product', 'merchandise', 'goods', 'item', 'price tag', 'barcode', 'stockroom', 'warehouse', 'pallet']
        },
        {
            name: 'Retail & Service Operations', priority: 13, level: 'Medium',
            verbs: ['serve', 'checkout', 'ring up', 'scan', 'bill', 'charge', 'process payment', 'take order', 'greet', 'assist'],
            objects: ['customer', 'cashier', 'register', 'pos', 'receipt', 'payment', 'order', 'menu', 'counter', 'checkout']
        },
        {
            name: 'Human Interaction & Handoffs', priority: 14, level: 'Easy',
            verbs: ['hand', 'hand over', 'give', 'pass', 'receive', 'deliver', 'show', 'handoff', 'exchange'],
            objects: ['person', 'customer', 'coworker', 'colleague', 'another person', 'someone', 'child', 'guest'],
            requireObject: true
        },
        {
            name: 'Healthcare & Caregiving', priority: 15, level: 'Medium',
            verbs: ['trim','cut','shave','bandage', 'dress', 'feed', 'bathe', 'inject', 'administer', 'care', 'massage', 'dispense', 'compound','washing'],
            objects: ['hair','patient', 'wound', 'bandage', 'medicine', 'medication', 'pill', 'prescription', 'blood pressure', 'thermometer', 'syringe', 'baby', 'elderly', 'gauze']
        },
        {
            name: 'Home Appliance Interaction', priority: 16, level: 'Easy',
            verbs: ['operate', 'turn on', 'turn off', 'switch on', 'switch off', 'set', 'press', 'start', 'open', 'close', 'load', 'unload', 'use'],
            objects: ['microwave', 'washing machine', 'dryer', 'refrigerator', 'fridge', 'oven', 'kettle', 'blender', 'rice cooker', 'toaster', 'air fryer', 'coffee machine', 'dishwasher', 'vacuum cleaner', 'fan', 'air conditioner', 'appliance'],
            requireObject: true
        },
        {
            name: 'Electronics & Diagnostics', priority: 17, level: 'Hard',
            verbs: ['solder', 'desolder', 'diagnose', 'test', 'probe', 'measure', 'wire', 'program', 'flash', 'debug', 'troubleshoot', 'calibrate'],
            objects: ['circuit', 'circuit board', 'pcb', 'chip', 'resistor', 'capacitor', 'multimeter', 'oscilloscope', 'soldering iron', 'wire', 'cable', 'connector', 'battery', 'phone', 'smartphone', 'laptop', 'computer', 'motherboard', 'screen', 'electronic', 'led', 'sensor', 'voltage']
        },
        {
            name: 'Dish Handling', priority: 18, level: 'Easy',
            verbs: ['wash', 'rinse', 'dry', 'stack', 'scrub', 'load', 'unload', 'put away', 'soak'],
            objects: ['dish', 'plate', 'bowl', 'cup', 'mug', 'glass', 'cutlery', 'utensil', 'spoon', 'fork', 'chopstick', 'pot', 'pan', 'tray', 'dishwasher', 'dish rack'],
            requireObject: true
        }
    ];

    /* ---------------------------------------------------------------------
     * NLP & TRANSLATION UTILITIES
     * --------------------------------------------------------------------- */
    function isVietnamese(text) {
        return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổổơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
    }

    async function translateToEnglish(text) {
        if (!text || !isVietnamese(text)) return text;
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=en&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data && data[0] && data[0][0] && data[0][0][0]) {
                const translated = data[0][0][0].trim();
                console.log(`🌐 [AUTO TRANSLATE VI->EN]: "${text}" -> "${translated}"`);
                return translated;
            }
        } catch (e) {
            console.error("Lỗi khi dịch tự động tiếng Việt:", e);
        }
        return text;
    }

    const DIFFICULTY_RULES = {
        hard: [
            'engine', 'transmission', 'circuit', 'pcb', 'solder', 'soldering', 'weld', 'welding',
            'diagnose', 'diagnosing', 'troubleshoot', 'motherboard', 'wiring', 'rewire', 'calibrate',
            'structure', 'scaffold', 'beam', 'formwork', 'lay brick', 'brick', 'plaster', 'drywall',
            'carve', 'carving', 'lathe', 'tailor', 'alteration', 'upholster', 'reupholster',
            'inject', 'compound', 'prescription', 'cake decorating', 'sushi', 'fillet', 'engrave'
        ],
        medium: [
            'cook', 'fry', 'bake', 'knead', 'grill', 'meal', 'recipe', 'assemble', 'install', 'mount',
            'change oil', 'oil change', 'replace tire', 'change tire', 'remove wheel', 'wheel bolt', 'lug nut',
            'brake', 'repair', 'fix', 'drill', 'saw', 'table saw', 'sand', 'cut', 'chisel', 'grind',
            'sew', 'stitch', 'iron', 'checkout', 'cashier', 'scan', 'payment', 'measure', 'adjust',
            'tighten', 'loosen', 'wrench', 'screwdriver', 'replace', 'sharpen', 'paint', 'tile'
        ],
        easyOverride: [
            'check tire pressure', 'check tyre pressure', 'check the tire pressure',
            'wipe', 'fold', 'sort vegetable', 'sort the vegetable'
        ]
    };

    const SUBJECT_WORDS = new Set(['person', 'worker', 'operator', 'someone', 'individual', 'man', 'woman', 'he', 'she', 'they', 'user', 'staff', 'employee', 'chef', 'mechanic', 'technician']);
    const AUX_WORDS = new Set(['is', 'are', 'was', 'were', 'be', 'being', 'been', 'starts', 'begins', 'continues', 'keeps', 'then']);
    const ARTICLES = new Set(['a', 'an', 'the', 'some', 'any', 'this', 'that', 'these', 'those', 'his', 'her', 'their', 'its', 'my', 'all', 'each', 'several', 'few', 'more', 'other', 'another', 'two', 'three', 'four', 'five', 'one', 'of']);
    const PARTICLES = new Set(['up', 'down', 'away', 'out', 'off', 'over', 'back', 'together', 'aside', 'apart']);
    const BOUNDARY_WORDS = new Set([
        'with', 'using', 'via', 'by', 'on', 'onto', 'upon', 'in', 'inside', 'into', 'at', 'near',
        'beside', 'under', 'over', 'from', 'to', 'through', 'across', 'around', 'for',
        'so', 'behind', 'next', 'against', 'between'
    ]);
    const LOCATION_PREPOSITIONS = new Set(['on', 'onto', 'in', 'inside', 'into', 'at', 'near', 'beside', 'under', 'from', 'to']);
    const PRONOUN_OBJECTS = new Set(['it', 'them', 'this', 'that', 'they', 'him', 'her']);

    const DOUBLE_CONSONANT = new Set([
        'cut', 'put', 'set', 'sit', 'run', 'get', 'hit', 'dig', 'chop', 'mop', 'scrub', 'stir',
        'wrap', 'tap', 'drop', 'plan', 'shop', 'trim', 'pin', 'skim', 'grip', 'strip', 'slip',
        'ship', 'tip', 'rub', 'drag', 'swap', 'grab', 'pat', 'knit', 'spin', 'begin', 'plug',
        'snip', 'stop', 'tag', 'clip', 'dip', 'flip', 'jog', 'nod', 'pop', 'sip', 'slit', 'spot',
        'step', 'trap', 'zip', 'blot', 'dab', 'hem', 'jam', 'pad', 'pit', 'plot', 'prop', 'shred',
        'slam', 'snap', 'sob', 'scan', 'ban', 'stab', 'stem', 'strap', 'swab', 'swim', 'tan', 'tug', 'wed', 'bag', 'peg', 'dam'
    ]);
    const IRREGULAR_ING = { be: 'being', see: 'seeing', lie: 'lying', tie: 'tying', die: 'dying', dye: 'dyeing', hoe: 'hoeing' };
    const KEEP_PLURAL = new Set(['feet', 'clothes', 'pants', 'scissors', 'glasses', 'jeans', 'tongs', 'pliers', 'shorts', 'goods', 'supplies', 'series', 'species', 'dishes_keep']);
    const IRREGULAR_SINGULAR = { knives: 'knife', shelves: 'shelf', leaves: 'leaf', loaves: 'loaf', halves: 'half', children: 'child', people: 'person', teeth: 'tooth', mice: 'mouse', men: 'man', women: 'woman' };

    function normalizeText(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[’']/g, '')
            .replace(/[-_/]/g, ' ')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function singularize(word) {
        if (!word || word.length <= 3) return word;
        if (KEEP_PLURAL.has(word)) return word;
        if (IRREGULAR_SINGULAR[word]) return IRREGULAR_SINGULAR[word];
        if (/(ss|us|is)$/.test(word)) return word;
        if (/ies$/.test(word)) return word.slice(0, -3) + 'y';
        if (/(ches|shes|xes|sses|zes)$/.test(word)) return word.slice(0, -2);
        if (/oes$/.test(word)) return word.slice(0, -2);
        if (/s$/.test(word)) return word.slice(0, -1);
        return word;
    }

    const KNOWN_VERBS = new Set();
    SKILL_GROUPS.forEach(g => g.verbs.forEach(v => KNOWN_VERBS.add(v.split(' ')[0])));
    ['remove', 'take', 'open', 'close', 'check', 'inspect', 'apply', 'spread', 'prepare', 'make',
        'water', 'plant', 'harvest', 'trim', 'prune', 'feed', 'hang', 'replace', 'adjust', 'write',
        'type', 'read', 'weigh', 'fill', 'empty', 'pour', 'scoop', 'unpack', 'unbox', 'unwrap',
        'repot', 'weed', 'rake', 'dig', 'shovel', 'paint', 'glaze', 'decorate', 'shape', 'mold',
        'stuff', 'thread', 'knot', 'tie', 'untie', 'string', 'restring', 'cover', 'uncover', 'spray',
        'squeeze', 'press', 'cut', 'put', 'set', 'run', 'stir', 'chop', 'mop', 'wrap', 'dye', 'see', 'secure', 'insert', 'attach']
        .forEach(v => KNOWN_VERBS.add(v));

    function baseVerb(word) {
        if (!word.endsWith('ing') || word.length <= 4) {
            if (/[^s]s$/.test(word) && word.length > 3 && !/(ss\vert{}us)$/.test(word)) {
                if (/(ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
                if (/ies$/.test(word)) return word.slice(0, -3) + 'y';
                return word.slice(0, -1);
            }
            return word;
        }
        let stem = word.slice(0, -3);
        if (stem.endsWith('y') && ['ly', 'ty', 'dy'].includes(stem.slice(-2)) && stem.length <= 3) {
            return stem.slice(0, -1) + 'ie';
        }
        if (stem.length >= 2 && stem.slice(-1) === stem.slice(-2, -1) && DOUBLE_CONSONANT.has(stem.slice(0, -1))) {
            return stem.slice(0, -1);
        }
        if (KNOWN_VERBS.has(stem + 'e')) return stem + 'e';
        return stem;
    }

    function toVerbIng(verb) {
        const word = normalizeText(verb).split(' ')[0];
        if (!word) return '';
        if (IRREGULAR_ING[word]) return IRREGULAR_ING[word];
        if (word.endsWith('ing') && word.length > 5) return word;
        if (DOUBLE_CONSONANT.has(word)) return word + word.slice(-1) + 'ing';
        if (word.endsWith('ie')) return word.slice(0, -2) + 'ying';
        if (word.endsWith('e') && !/(ee|ye|oe)$/.test(word)) return word.slice(0, -1) + 'ing';
        return word + 'ing';
    }

    function isVerbLike(word) {
        if (!word) return false;
        if (KNOWN_VERBS.has(word)) return true;
        const b = baseVerb(word);
        return KNOWN_VERBS.has(b) || (word.endsWith('ing') && word.length > 5);
    }

    /* =====================================================================
     * PARSE DESCRIPTION: LOẠ BỎ TOOL KHỎI ACTIVITY ID
     * ===================================================================== */
    function parseDescription(description) {
        const text = normalizeText(description);
        let words = text.split(' ').filter(Boolean);

        let i = 0;
        while (i < words.length && (ARTICLES.has(words[i]) || SUBJECT_WORDS.has(words[i]) || AUX_WORDS.has(words[i]))) i++;

        if (!isVerbLike(words[i])) {
            for (let j = i; j < Math.min(words.length, i + 4); j++) {
                if (isVerbLike(words[j])) { i = j; break; }
            }
        }

        const rawVerb1 = words[i] || '';
        const verb1 = baseVerb(rawVerb1);
        let k = i + 1;

        let phrasal1 = verb1;
        if (PARTICLES.has(words[k])) {
            phrasal1 = `${verb1} ${words[k]}`;
            k++;
        }

        let secondVerbIng = null;
        
        if (k < words.length && words[k] === 'and') {
            let tempK = k + 1;
            while (tempK < words.length && (AUX_WORDS.has(words[tempK]) || SUBJECT_WORDS.has(words[tempK]) || words[tempK] === 'then')) {
                tempK++;
            }
            if (tempK < words.length && isVerbLike(words[tempK])) {
                const rawVerb2 = words[tempK];
                const verb2 = baseVerb(rawVerb2);
                tempK++;
                let phrasal2 = verb2;
                if (PARTICLES.has(words[tempK])) {
                    phrasal2 = `${verb2} ${words[tempK]}`;
                    tempK++;
                }
                const p2 = phrasal2.split(' ')[1];
                secondVerbIng = p2 === 'away' ? `${toVerbIng(verb2)}_away` : toVerbIng(verb2);
                k = tempK;
            }
        }

        const objectRaw = [];
        let collectingObject = true;

        while (k < words.length) {
            const w = words[k];

            if (['with', 'using', 'via', 'by'].includes(w)) {
                collectingObject = false;
                k++;
                continue;
            }

            if (w === 'and' || w === 'then') {
                collectingObject = false;
                k++;
                while (k < words.length && (AUX_WORDS.has(words[k]) || SUBJECT_WORDS.has(words[k]) || words[k] === 'then')) {
                    k++;
                }
                if (k < words.length && isVerbLike(words[k])) {
                    const rawVerb2 = words[k];
                    const verb2 = baseVerb(rawVerb2);
                    k++;
                    let phrasal2 = verb2;
                    if (PARTICLES.has(words[k])) {
                        phrasal2 = `${verb2} ${words[k]}`;
                        k++;
                    }
                    const p2 = phrasal2.split(' ')[1];
                    secondVerbIng = p2 === 'away' ? `${toVerbIng(verb2)}_away` : toVerbIng(verb2);
                }
                k++;
                continue;
            }

            if (BOUNDARY_WORDS.has(w) || LOCATION_PREPOSITIONS.has(w)) {
                collectingObject = false;
                k++;
                continue;
            }

            if (collectingObject) {
                if (!ARTICLES.has(w) && !PARTICLES.has(w) && !PRONOUN_OBJECTS.has(w)) {
                    objectRaw.push(w);
                }
            }
            k++;
        }

        const objectWords = objectRaw.map(singularize).slice(-CONFIG.maxObjectWords);

        const particle1 = phrasal1.split(' ')[1];
        const actionIng1 = particle1 === 'away' ? `${toVerbIng(verb1)}_away` : toVerbIng(verb1);

        let actionPart = actionIng1;
        if (secondVerbIng) {
            actionPart = `${actionIng1}_${secondVerbIng}`;
        }

        // Chỉ gồm [object] và [action/verb] theo đúng yêu cầu
        const activityId = [...(objectWords.length ? objectWords : ['object']), actionPart]
            .filter(Boolean)
            .join(CONFIG.activitySeparator);

        console.groupCollapsed(`🔍 [TBRAIN PARSE DEBUG] "${description}"`);
        console.log("📝 Processed Text:", text);
        console.log("🎯 Verb 1:", verb1, "| Action ING 1:", actionIng1);
        console.log("🔗 Second Verb ING:", secondVerbIng);
        console.log("📦 Object Words:", objectWords);
        console.log("⚡ Final Activity ID Result (No Tool):", activityId);
        console.groupEnd();

        return { 
            text, 
            verb: verb1, 
            phrasal: phrasal1, 
            actionIng: actionPart, 
            objectWords, 
            objectText: objectRaw.map(singularize).join(' '), 
            activityId 
        };
    }

    function singularText(text) {
        return normalizeText(text).split(' ').map(singularize).join(' ');
    }

    function hasPhrase(haystack, phrase) {
        const p = singularText(phrase);
        if (!p) return false;
        return (` ${haystack} `).includes(` ${p} `);
    }

    function classifySkillGroup(parsed) {
        const full = singularText(parsed.text);
        const objectCtx = singularText(parsed.objectText);
        const verb = parsed.verb;
        const phrasal = parsed.phrasal;

        const results = SKILL_GROUPS.map(group => {
            let score = 0;
            const matched = [];
            const verbHit = group.verbs.find(v => v === phrasal || v === verb);
            if (verbHit) { score += 10; matched.push(`verb:${verbHit}`); }

            let objHits = 0;
            for (const o of group.objects) {
                if (hasPhrase(objectCtx, o)) { objHits++; matched.push(`obj:${o}`); }
                else if (hasPhrase(full, o)) { objHits += 0.5; matched.push(`ctx:${o}`); }
            }
            score += Math.min(objHits, 3) * 4;
            if (group.requireObject && objHits === 0) score = verbHit ? 2 : 0;
            return { name: group.name, score, priority: group.priority, level: group.level, matched };
        });

        results.sort((a, b) => b.score - a.score || a.priority - b.priority);
        const best = results[0];
        if (!best || best.score === 0) {
            return { name: 'Pick and Place / Object Handling', score: 0, level: 'Easy', matched: [], ranking: results.slice(0, 3) };
        }
        return { ...best, ranking: results.slice(0, 3) };
    }

    function classifyDifficulty(parsed, skill) {
        const full = singularText(parsed.text);
        const hit = list => list.filter(k => hasPhrase(full, k));

        const easy = hit(DIFFICULTY_RULES.easyOverride);
        if (easy.length) return { name: 'Easy', reason: `Guideline example: ${easy[0]}` };

        const hard = hit(DIFFICULTY_RULES.hard);
        if (hard.length) return { name: 'Hard', reason: `Skilled keyword: ${hard.join(', ')}` };

        const medium = hit(DIFFICULTY_RULES.medium);
        const levels = ['Easy', 'Medium', 'Hard'];
        let level = skill.level || 'Easy';
        if (medium.length && levels.indexOf(level) < 1) level = 'Medium';
        if (skill.name === 'Electronics & Diagnostics' && !hard.length && !medium.length) level = 'Medium';

        return {
            name: level,
            reason: medium.length ? `Multi-step keyword: ${medium.join(', ')}` : `Default of ${skill.name}`
        };
    }

    function findFirstElement(selectors, root = document) {
        for (const selector of selectors) {
            const el = root.querySelector(selector);
            if (el) return el;
        }
        return null;
    }

    function findInputNearLabel(labelTexts, root = document) {
        const candidates = Array.from(root.querySelectorAll('label, span, p, div'))
            .filter(el => el.children.length <= 2 && el.textContent.trim().length < 60);

        const label = candidates.find(el => {
            const t = normalizeText(el.textContent);
            return labelTexts.some(l => t === normalizeText(l) || t.startsWith(normalizeText(l)));
        });
        if (!label) return null;

        if (label.matches('label') && label.htmlFor) {
            const linked = document.getElementById(label.htmlFor);
            if (linked) return linked;
        }

        let node = label;
        for (let depth = 0; depth < 4 && node; depth++) {
            const input = node.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea');
            if (input) return input;
            node = node.parentElement;
        }
        return null;
    }

    const getDescriptionElement = (root = document) => findFirstElement(CONFIG.selectors.description, root) || findInputNearLabel(['task description', 'description'], root);
    const getActivityElement = (root = document) => findFirstElement(CONFIG.selectors.activity, root) || findInputNearLabel(['activity'], root);
    const getSkillGroupElement = (root = document) => findFirstElement(CONFIG.selectors.skillGroup, root) || findInputNearLabel(['skill group', 'skill'], root);
    const getSceneElement = (root = document) => findFirstElement(CONFIG.selectors.scene, root) || findInputNearLabel(['scene environment l3', 'environment l3', 'scene', 'l3'], root);

    function setNativeValue(element, value) {
        if (!element) return false;
        const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(element, value); else element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    function clickOptionByText(targetText) {
        const target = normalizeText(targetText);
        const activeListboxes = Array.from(document.querySelectorAll('[role="listbox"], .dropdown-menu, .MuiAutocomplete-popper, [class*="dropdown"], [class*="menu"]'))
            .filter(el => el.offsetParent !== null);

        let candidates = [];
        if (activeListboxes.length > 0) {
            for (const box of activeListboxes) {
                const items = Array.from(box.querySelectorAll('button, [role="option"], [role="button"], li, div, span'))
                    .filter(el => el.offsetParent !== null && normalizeText(el.textContent) === target);
                candidates = candidates.concat(items);
            }
        }

        if (candidates.length === 0) {
            candidates = Array.from(document.querySelectorAll('button, [role="option"], [role="button"], li, div, span'))
                .filter(el => el.offsetParent !== null && normalizeText(el.textContent) === target);
        }

        if (candidates.length === 0) return false;
        candidates[0].click();
        return true;
    }

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function setComboBoxValue(element, value) {
        if (!element || !value) return false;
        element.focus();
        element.click();
        setNativeValue(element, value);
        await sleep(300);

        if (clickOptionByText(value)) {
            await sleep(100);
            element.blur();
            return true;
        }

        ['keydown', 'keypress', 'keyup'].forEach(type => {
            element.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        });
        await sleep(150);
        element.blur();
        return true;
    }

    const CLIPBOARD_KEY = 'tbHelperSegmentClipboard';
    function storageGet(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
    function storageSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { } }

    let segmentClipboard = storageGet(CLIPBOARD_KEY);
    const DIFFICULTY_NAMES = ['Easy', 'Medium', 'Hard'];

    function readDifficulty(root) {
        const isVisible = el => el.offsetParent !== null || el.getClientRects().length > 0;
        const isSelectedEl = el => {
            if (['aria-checked', 'aria-pressed', 'aria-selected', 'aria-current'].some(a => el.getAttribute(a) === 'true')) return true;
            const state = el.getAttribute('data-state');
            if (state && /^(checked|on|active|selected)$/i.test(state)) return true;
            const cls = (el.className && el.className.toString()) || '';
            if (/(^|[\s_-])(selected|active|checked)([\s_-]|$)/i.test(cls)) return true;
            const input = el.matches('input') ? el : el.querySelector('input[type="radio"], input[type="checkbox"]');
            return !!(input && input.checked);
        };
        const candidates = Array.from(root.querySelectorAll('button, [role="button"], [role="radio"], [role="option"], [role="tab"], label, li')).filter(isVisible);
        const hit = candidates.find(el => DIFFICULTY_NAMES.some(n => normalizeText(n) === normalizeText(el.textContent)) && isSelectedEl(el));
        if (hit) return DIFFICULTY_NAMES.find(n => normalizeText(n) === normalizeText(hit.textContent));
        return '';
    }

    function getCurrentSegmentRoot() {
        const descEl = getDescriptionElement();
        if (!descEl) return document.body;
        let node = descEl;
        while (node && node !== document.body) {
            if (node.querySelectorAll('[data-testid^="episode-index-row-"]').length > 0 || node.classList.contains('segment') || node.tagName === 'FORM') {
                return node;
            }
            node = node.parentElement;
        }
        return document.body;
    }

    function readCurrentSegmentData() {
        const root = getCurrentSegmentRoot();
        const val = el => (el && 'value' in el ? String(el.value).trim() : '');
        return {
            description: val(getDescriptionElement(root)),
            activity: val(getActivityElement(root)),
            skillGroup: val(getSkillGroupElement(root)),
            difficulty: readDifficulty(root),
            l3: val(getSceneElement(root))
        };
    }

    let isLoopRunning = false;
    let isL3LoopRunning = false;

    async function analyze(description) {
        const translatedDesc = await translateToEnglish(description);
        const parsed = parseDescription(translatedDesc);
        const skill = classifySkillGroup(parsed);
        const difficulty = classifyDifficulty(parsed, skill);
        return { translatedDesc, parsed, skill, difficulty };
    }

    async function runAutoFill() {
        try {
            const descEl = getDescriptionElement();
            if (!descEl || !descEl.value.trim()) return false;

            const rawText = descEl.value.trim();
            const result = await analyze(rawText);

            if (result.translatedDesc && result.translatedDesc !== rawText) {
                setNativeValue(descEl, result.translatedDesc);
            }

            const activityEl = getActivityElement();
            if (activityEl) setNativeValue(activityEl, result.parsed.activityId);

            const skillEl = getSkillGroupElement();
            if (skillEl) await setComboBoxValue(skillEl, result.skill.name);
            else clickOptionByText(result.skill.name);

            clickOptionByText(result.difficulty.name);

            const inputEl = document.getElementById('tb-l3-custom-input');
            const customVal = inputEl ? inputEl.value.trim() : '';
            if (customVal) {
                const sceneEl = getSceneElement();
                if (sceneEl) await setComboBoxValue(sceneEl, customVal);
            }

            segmentClipboard = readCurrentSegmentData();
            storageSet(CLIPBOARD_KEY, segmentClipboard);
            return true;
        } catch (err) {
            console.error("Lỗi khi chạy AutoFill:", err);
            return false;
        }
    }

    function runCopySegment() {
        segmentClipboard = readCurrentSegmentData();
        storageSet(CLIPBOARD_KEY, segmentClipboard);

        const btnCopy = document.getElementById('tb-inject-copy');
        if (btnCopy) {
            const originalText = btnCopy.innerHTML;
            btnCopy.innerHTML = '✅ Copied!';
            btnCopy.style.backgroundColor = '#059669';
            setTimeout(() => {
                btnCopy.innerHTML = originalText;
                btnCopy.style.backgroundColor = '#6366f1';
            }, 1000);
        }
        console.log('[TBRAIN] Đã copy thông tin segment:', segmentClipboard);
    }

    async function runPasteSegment() {
        if (!segmentClipboard) { alert('Chưa có dữ liệu nào được lưu.'); return; }
        const root = getCurrentSegmentRoot();
        const data = segmentClipboard;
        try {
            if (data.description) { const el = getDescriptionElement(root); if (el) setNativeValue(el, data.description); }
            if (data.activity) { const el = getActivityElement(root); if (el) setNativeValue(el, data.activity); }
            if (data.skillGroup) { const el = getSkillGroupElement(root); if (el) await setComboBoxValue(el, data.skillGroup); }
            if (data.difficulty) { clickOptionByText(data.difficulty, root); }
            if (data.l3) { const el = getSceneElement(root); if (el) await setComboBoxValue(el, data.l3); }
        } catch (err) { console.error('Lỗi khi paste:', err); }
    }

    async function runFillSingleL3() {
        const inputEl = document.getElementById('tb-l3-custom-input');
        const customVal = inputEl ? inputEl.value.trim() : '';
        if (!customVal) { alert('Vui lòng nhập giá trị L3 vào ô text box trước!'); return; }
        const sceneEl = getSceneElement();
        if (sceneEl) await setComboBoxValue(sceneEl, customVal);
    }

    async function runLoopFillL3() {
        if (isL3LoopRunning) { isL3LoopRunning = false; return; }
        const inputEl = document.getElementById('tb-l3-custom-input');
        const customVal = inputEl ? inputEl.value.trim() : '';
        if (!customVal) { alert('Vui lòng nhập giá trị L3 vào ô text box trước!'); return; }

        const episodeButtons = Array.from(document.querySelectorAll('[data-testid^="episode-index-row-"]'));
        if (!episodeButtons.length) { runFillSingleL3(); return; }

        isL3LoopRunning = true;
        document.querySelectorAll('.tb-inject-fill-l3-loop-btn').forEach(b => { b.textContent = '⏹ Stop Fill L3 All'; b.style.backgroundColor = '#dc2626'; });

        for (let idx = 0; idx < episodeButtons.length; idx++) {
            if (!isL3LoopRunning) break;
            const btn = episodeButtons[idx];
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            btn.click();
            await sleep(CONFIG.delayBetweenEpisodes);
            if (!isL3LoopRunning) break;
            const sceneEl = getSceneElement();
            if (sceneEl) await setComboBoxValue(sceneEl, customVal);
            await sleep(300);
        }

        isL3LoopRunning = false;
        document.querySelectorAll('.tb-inject-fill-l3-loop-btn').forEach(b => { b.textContent = '🔄 Fill L3 All'; b.style.backgroundColor = '#059669'; });
    }

    async function runLoopAllEpisodes() {
        if (isLoopRunning) { isLoopRunning = false; return; }
        const episodeButtons = Array.from(document.querySelectorAll('[data-testid^="episode-index-row-"]'));
        if (!episodeButtons.length) { alert('Không tìm thấy danh sách episode.'); return; }

        isLoopRunning = true;
        document.querySelectorAll('.tb-inject-loop-btn').forEach(b => { b.textContent = '⏹ Stop'; b.style.backgroundColor = '#dc2626'; });

        for (let idx = 0; idx < episodeButtons.length; idx++) {
            if (!isLoopRunning) break;
            const btn = episodeButtons[idx];
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            btn.click();
            await sleep(CONFIG.delayBetweenEpisodes);
            if (!isLoopRunning) break;

            const descEl = getDescriptionElement();
            if (descEl && descEl.value.trim() && descEl.value.trim() !== 'no description yet') {
                await runAutoFill();
            } else if (segmentClipboard) {
                await runPasteSegment();
            }
            await sleep(300);
        }

        isLoopRunning = false;
        document.querySelectorAll('.tb-inject-loop-btn').forEach(b => { b.textContent = '🔄 Fill All'; b.style.backgroundColor = '#4338ca'; });
    }

    /* ---------------------------------------------------------------------
     * AUTO-FETCH LOGIC & NETWORK INTERCEPTION
     * --------------------------------------------------------------------- */
    const log = {
        info: (...a) => console.log("[INFO]", ...a),
        warn: (...a) => console.warn("[WARN]", ...a),
        error: (...a) => console.error("[ERROR]", ...a)
    };

    const now = () => performance.now();
    function perf(label, start) { if (PERF_LOG) log.info(`[PERF] ${label}: ${(now() - start).toFixed(1)} ms`); }

    const rateLimitState = { limit: null, remaining: null, resetAt: 0, pauseUntil: 0, lastStatus: null };

    function readRateLimitHeaders(response) {
        const headers = response.headers;
        const limitRaw = headers.get("x-ratelimit-limit");
        const remainingRaw = headers.get("x-ratelimit-remaining");
        const resetRaw = headers.get("x-ratelimit-reset");

        const limit = limitRaw === null ? NaN : Number(limitRaw);
        const remaining = remainingRaw === null ? NaN : Number(remainingRaw);

        if (Number.isFinite(limit) && limit >= 0) rateLimitState.limit = limit;
        if (Number.isFinite(remaining) && remaining >= 0) rateLimitState.remaining = remaining;

        if (resetRaw !== null) {
            const reset = Number(resetRaw);
            if (Number.isFinite(reset) && reset >= 0) {
                rateLimitState.resetAt = reset > 1e9 ? reset * 1000 : Date.now() + reset * 1000;
            }
        }
        rateLimitState.lastStatus = response.status;
        if (response.status === 429) {
            rateLimitState.pauseUntil = Math.max(rateLimitState.pauseUntil, Date.now() + RATE_LIMIT_FALLBACK_WAIT + RATE_LIMIT_SAFETY_MS);
        }
    }

    async function waitForRateLimit() {
        while (!stopped) {
            const waitMs = rateLimitState.pauseUntil - Date.now();
            if (waitMs <= 0) return;
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }
        throw new Error("Task monitor stopped");
    }

    function getAdaptivePollInterval() {
        return Math.max(POLL_INTERVAL, MIN_SAFE_POLL_INTERVAL);
    }

    const JWT_RE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
    const interceptedTokens = new Map();
    const rejectedTokens = new Set();
    let cachedTokenCandidate = null;
    let lastTokenValue = null;

    function decodePayload(token) {
        try {
            let p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
            p += "=".repeat((4 - p.length % 4) % 4);
            const binary = atob(p);
            const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
            return JSON.parse(new TextDecoder().decode(bytes));
        } catch (_) { return null; }
    }

    function scoreSource(source) {
        let score = 0;
        if (/access|auth|jwt|bearer|token|session/i.test(source)) score += 2;
        if (/refresh/i.test(source)) score -= 5;
        return score;
    }

    function scanString(raw, source, found) {
        if (typeof raw !== "string" || raw.length < 20) return;
        JWT_RE.lastIndex = 0;
        let match;
        while ((match = JWT_RE.exec(raw)) !== null) {
            const token = match[0];
            if (rejectedTokens.has(token)) continue;
            const payload = decodePayload(token);
            if (!payload) continue;
            const candidate = { token, source, payload, score: scoreSource(source) };
            const existing = found.get(token);
            if (!existing || candidate.score > existing.score) found.set(token, candidate);
        }
    }

    function scanStorage(storage, label, found) {
        try {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (key !== null) scanString(storage.getItem(key), `${label}:${key}`, found);
            }
        } catch (_) {}
    }

    function scanCookies(found) {
        try {
            for (const pair of document.cookie.split(";")) {
                const index = pair.indexOf("=");
                if (index >= 0) scanString(pair.slice(index + 1).trim(), `cookie:${pair.slice(0, index).trim()}`, found);
            }
        } catch (_) {}
    }

    function findToken(forceScan = false) {
        const timestamp = Date.now();
        if (!forceScan && cachedTokenCandidate) {
            const cached = cachedTokenCandidate;
            const expiry = Number(cached.payload.exp);
            if (!rejectedTokens.has(cached.token) && (!expiry || expiry * 1000 > timestamp + 5000)) return cached;
            cachedTokenCandidate = null;
        }

        const found = new Map();
        for (const token of interceptedTokens.keys()) {
            if (!rejectedTokens.has(token)) {
                const payload = decodePayload(token);
                if (payload) found.set(token, { token, source: "intercepted request", payload, score: 10 });
            }
        }

        if (forceScan || found.size === 0) {
            scanStorage(window.localStorage, "localStorage", found);
            scanStorage(window.sessionStorage, "sessionStorage", found);
            scanCookies(found);
        }

        let best = null;
        for (const candidate of found.values()) {
            if (!rejectedTokens.has(candidate.token)) {
                const expiry = Number(candidate.payload.exp);
                if (!expiry || expiry * 1000 > timestamp + 5000) {
                    if (!best || candidate.score > best.score) best = candidate;
                }
            }
        }
        cachedTokenCandidate = best;
        return best;
    }

    const origFetch = window.fetch;
    const xhrProto = XMLHttpRequest.prototype;
    const origOpen = xhrProto.open;
    const origSetHeader = xhrProto.setRequestHeader;

    function captureAuth(value, url) {
        try {
            if (typeof value !== "string" || !url) return;
            const parsed = new URL(String(url), location.href);
            if (parsed.hostname.endsWith("tbrain.ai")) {
                JWT_RE.lastIndex = 0;
                let match;
                while ((match = JWT_RE.exec(value)) !== null) interceptedTokens.set(match[0], Date.now());
            }
        } catch (_) {}
    }

    function readHeaders(headers) {
        if (!headers) return null;
        try {
            if (headers instanceof Headers) return headers.get("authorization");
            if (Array.isArray(headers)) {
                for (const pair of headers) if (String(pair[0]).toLowerCase() === "authorization") return String(pair[1]);
            } else if (typeof headers === "object") {
                for (const key of Object.keys(headers)) if (key.toLowerCase() === "authorization") return String(headers[key]);
            }
        } catch (_) {}
        return null;
    }

    window.fetch = function (input, init) {
        try {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input && input.url;
            const auth = readHeaders(init && init.headers) || readHeaders(input && input.headers);
            if (auth) captureAuth(auth, url);
        } catch (_) {}
        return origFetch.apply(this, arguments);
    };

    xhrProto.open = function (method, url) { this.tbMonitorUrl = String(url); return origOpen.apply(this, arguments); };
    xhrProto.setRequestHeader = function (name, value) {
        if (String(name).toLowerCase() === "authorization") captureAuth(value, this.tbMonitorUrl);
        return origSetHeader.apply(this, arguments);
    };

    let audioCtx = null;
    let deniedLogged = false;

    async function ensurePermission() {
        if (!("Notification" in window)) return false;
        if (Notification.permission === "granted") return true;
        if (Notification.permission === "denied") {
            if (!deniedLogged) {
                log.warn("Notification permission denied.");
                deniedLogged = true;
            }
            return false;
        }
        try {
            return await Notification.requestPermission() === "granted";
        } catch (_) {
            return false;
        }
    }

    function unlockAudio() {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC && !audioCtx) audioCtx = new AC();
            if (audioCtx && audioCtx.state === "suspended") void audioCtx.resume();
        } catch (_) {}
    }

    function beep() {
        try {
            if (!audioCtx) unlockAudio();
            if (!audioCtx || audioCtx.state !== "running") return;
            const start = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.value = 880;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(start);
            osc.stop(start + 0.15);
        } catch (_) {}
    }

    async function showAcquireNotification(acquiredTasks) {
        if (!acquiredTasks || acquiredTasks.length === 0) return;
        beep();

        if (!(await ensurePermission())) {
            log.info("[NOTIFICATION PERMISSION DENIED]", acquiredTasks);
            return;
        }

        try {
            for (const item of acquiredTasks) {
                const hours = Number.isFinite(item.durationSeconds) 
                    ? (item.durationSeconds / 3600).toFixed(2) 
                    : "Unknown";

                const title = "🚀 Đã nhận Task mới thành công!";
                const body = `ID: ${item.id}\nThời lượng: ${hours} giờ`;

                const notification = new Notification(title, {
                    body: body,
                    tag: `tbrain-acquired-${item.id}`,
                    renotify: true
                });

                notification.onclick = event => {
                    event.preventDefault();
                    window.open(CLICK_URL, "_blank");
                    try { window.focus(); } catch (_) {}
                    notification.close();
                };
            }
        } catch (error) {
            log.error("Notification failed:", error.message);
        }
    }

    function getTaskId(task) {
        if (!task) return null;
        const id = task.id !== undefined ? task.id : task.taskId !== undefined ? task.taskId : task._id;
        return id != null ? String(id) : null;
    }

    async function fetchPool(token) {
        await waitForRateLimit();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        try {
            const response = await origFetch.call(window, API_URL, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
                credentials: "include",
                cache: "no-store",
                signal: controller.signal
            });
            readRateLimitHeaders(response);
            return response;
        } finally { clearTimeout(timeout); }
    }

    async function acquireTask(token, taskObj) {
        await waitForRateLimit();
        const id = getTaskId(taskObj);
        try {
            const response = await origFetch.call(window, `${API_BASE}/api/v1/tasks/${encodeURIComponent(id)}/acquire`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "*/*" },
                credentials: "include",
                body: "{}"
            });
            readRateLimitHeaders(response);
            return { taskObj, id, ok: response.ok, status: response.status };
        } catch (error) {
            return { taskObj, id, ok: false, status: 0 };
        }
    }

    async function acquireNew(token, taskList) {
        let successfullyAcquired = [];
        for (const taskObj of taskList) {
            const res = await acquireTask(token, taskObj);
            if (res.ok) {
                successfullyAcquired.push({
                    id: res.id,
                    durationSeconds: taskObj.durationSeconds
                });
            }
        }
        
        if (successfullyAcquired.length > 0) {
            await showAcquireNotification(successfullyAcquired);
        }

        return { success: successfullyAcquired.length, total: taskList.length };
    }

    function extractTasks(body) {
        if (Array.isArray(body)) return body;
        if (!body || typeof body !== "object") return null;
        for (const key of ["tasks", "items", "results", "data", "records", "rows", "content"]) {
            if (Array.isArray(body[key])) return body[key];
        }
        return null;
    }

    const seenIds = new Set();
    let firstPoll = true;
    let timer = null;
    let stopped = false;
    let cycleRunning = false;

    async function runCycle() {
        let candidate = findToken() || findToken(true);
        if (!candidate) return TOKEN_RETRY_INTERVAL;

        let response;
        try {
            response = await fetchPool(candidate.token);
        } catch (_) {
            return getAdaptivePollInterval();
        }

        if (response.status === 401 || response.status === 403) {
            rejectedTokens.add(candidate.token);
            cachedTokenCandidate = null;
            return TOKEN_RETRY_INTERVAL;
        }

        if (!response.ok) return getAdaptivePollInterval();

        let body;
        try { body = await response.json(); } catch (_) { return getAdaptivePollInterval(); }

        const tasks = extractTasks(body);
        if (!tasks) return getAdaptivePollInterval();

        const eligibleTasks = [];
        for (const task of tasks) {
            const id = getTaskId(task);
            if (id === null || seenIds.has(id) || EXCLUDED_TASK_IDS.has(id)) continue;
            seenIds.add(id);

            const duration = Number(task && task.durationSeconds);
            if (Number.isFinite(duration) && duration > MIN_DURATION_SECONDS) {
                eligibleTasks.push(task);
            }
        }

        if (eligibleTasks.length > 0) {
            if (AUTO_ACQUIRE) {
                await acquireNew(candidate.token, eligibleTasks);
            }
        }

        return getAdaptivePollInterval();
    }

    async function tick() {
        if (stopped || cycleRunning) return;
        cycleRunning = true;
        try {
            const delay = await runCycle();
            if (!stopped) timer = setTimeout(tick, delay);
        } catch (_) {
            if (!stopped) timer = setTimeout(tick, getAdaptivePollInterval());
        } finally {
            cycleRunning = false;
        }
    }

    function stop() {
        stopped = true;
        clearTimeout(timer);
    }

    tick();
    void ensurePermission();

    /* ---------------------------------------------------------------------
     * UI INJECTION
     * --------------------------------------------------------------------- */
    function injectUIControls() {
        const reportIssueBtn = document.querySelector('[data-testid="report-issue"]');
        const themeToggleBtn = document.querySelector('[data-testid="theme-toggle"]');

        if (reportIssueBtn && !document.getElementById('tb-inject-fill')) {
            const baseClass = reportIssueBtn.className;

            const btnFill = document.createElement('button');
            btnFill.id = 'tb-inject-fill';
            btnFill.type = 'button';
            btnFill.className = baseClass;
            btnFill.style.cssText = 'background-color: #4f46e5; color: #fff; border-color: #4f46e5;';
            btnFill.innerHTML = '⚡ Fill 1';
            btnFill.addEventListener('click', runAutoFill);

            const l3Input = document.createElement('input');
            l3Input.id = 'tb-l3-custom-input';
            l3Input.type = 'text';
            l3Input.placeholder = 'Enter L3...';
            l3Input.className = baseClass;
            l3Input.style.cssText = 'width: 130px; background-color: #ffffff !important; color: #000000 !important; border: 1px solid #ccc !important;';

            const btnFillSingleL3 = document.createElement('button');
            btnFillSingleL3.id = 'tb-inject-single-l3';
            btnFillSingleL3.type = 'button';
            btnFillSingleL3.className = baseClass;
            btnFillSingleL3.style.cssText = 'background-color: #10b981; color: #fff; border-color: #10b981;';
            btnFillSingleL3.innerHTML = '🎯 Fill L3 Only';
            btnFillSingleL3.addEventListener('click', runFillSingleL3);

            const btnFillL3Loop = document.createElement('button');
            btnFillL3Loop.id = 'tb-inject-l3-loop';
            btnFillL3Loop.type = 'button';
            btnFillL3Loop.className = `tb-inject-fill-l3-loop-btn ${baseClass}`;
            btnFillL3Loop.style.cssText = 'background-color: #059669; color: #fff; border-color: #059669;';
            btnFillL3Loop.innerHTML = '🔄 Fill L3 All';
            btnFillL3Loop.addEventListener('click', runLoopFillL3);

            const btnLoop = document.createElement('button');
            btnLoop.id = 'tb-inject-loop';
            btnLoop.type = 'button';
            btnLoop.className = `tb-inject-loop-btn ${baseClass}`;
            btnLoop.style.cssText = 'background-color: #4338ca; color: #fff; border-color: #4338ca;';
            btnLoop.innerHTML = '🔄 Fill All';
            btnLoop.addEventListener('click', runLoopAllEpisodes);

            const btnCopy = document.createElement('button');
            btnCopy.id = 'tb-inject-copy';
            btnCopy.type = 'button';
            btnCopy.className = baseClass;
            btnCopy.style.cssText = 'background-color: #6366f1; color: #fff; border-color: #6366f1;';
            btnCopy.innerHTML = '📋 Copy';
            btnCopy.addEventListener('click', runCopySegment);

            const btnPaste = document.createElement('button');
            btnPaste.id = 'tb-inject-paste';
            btnPaste.type = 'button';
            btnPaste.className = baseClass;
            btnPaste.style.cssText = 'background-color: #0ea5e9; color: #fff; border-color: #0ea5e9;';
            btnPaste.innerHTML = '📥 Paste';
            btnPaste.addEventListener('click', runPasteSegment);

            reportIssueBtn.insertAdjacentElement('afterend', btnPaste);
            reportIssueBtn.insertAdjacentElement('afterend', btnCopy);
            reportIssueBtn.insertAdjacentElement('afterend', btnLoop);
            reportIssueBtn.insertAdjacentElement('afterend', btnFill);
            reportIssueBtn.insertAdjacentElement('afterend', btnFillL3Loop);
            reportIssueBtn.insertAdjacentElement('afterend', btnFillSingleL3);
            reportIssueBtn.insertAdjacentElement('afterend', l3Input);
        }

        if (themeToggleBtn && !document.getElementById("tb-fetch-control-wrapper")) {
            const wrapper = document.createElement("div");
            wrapper.id = "tb-fetch-control-wrapper";
            wrapper.className = "flex items-center gap-2 mr-2 bg-tag-gray-bg/40 px-2 py-1 rounded-md border border-tb-border";

            const toggleBtn = document.createElement("button");
            toggleBtn.type = "button";
            toggleBtn.className = "px-2 py-1 text-xs font-semibold rounded text-white hover:opacity-90";

            let isActive = true;
            function updateToggleButton() {
                toggleBtn.textContent = isActive ? "Fetch Task: ON" : "Fetch Task: OFF";
                toggleBtn.style.backgroundColor = isActive ? "#2563eb" : "#dc2626";
            }
            updateToggleButton();

            toggleBtn.onclick = () => {
                isActive = !isActive;
                if (isActive) { stopped = false; updateToggleButton(); tick(); }
                else { stop(); updateToggleButton(); }
            };

            const pollInput = document.createElement("input");
            pollInput.type = "number";
            pollInput.value = POLL_INTERVAL;
            pollInput.className = "w-16 px-1.5 py-0.5 text-xs rounded bg-canvas border border-tb-border text-fg text-center";
            pollInput.onchange = e => { const val = parseInt(e.target.value, 10); if (val >= 500) POLL_INTERVAL = val; };

            const durationInput = document.createElement("input");
            durationInput.type = "number";
            durationInput.value = MIN_DURATION_SECONDS;
            durationInput.className = "w-16 px-1.5 py-0.5 text-xs rounded bg-canvas border border-tb-border text-fg text-center";
            durationInput.onchange = e => { const val = parseInt(e.target.value, 10); if (val >= 0) MIN_DURATION_SECONDS = val; };

            wrapper.appendChild(toggleBtn);
            wrapper.appendChild(pollInput);
            wrapper.appendChild(durationInput);

            themeToggleBtn.insertAdjacentElement("beforebegin", wrapper);
        }
    }

    setInterval(injectUIControls, 500);
    console.log('✅ Master Tbrain Script (No Tool in Activity) is ready.');
})();
