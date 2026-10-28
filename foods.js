// Edit the numbers in this list, then refresh the game.
// points: points multiplier
// growth: growth multiplier
// speed: speed stat, shown as-is in the inventory.
// odds: pull rate, shown in the game as "1 in {odds}"
// Golden and Shiny are not listed. Each craft step adds +2 points, 1.5× growth, and 1.5× speed.
// model: 3D file in the models folder. Golden and Shiny use the same model as the normal food.
// name, emoji, rarity, color, and rim can stay as they are.
window.FOOD_LIST = [
    // Common — avg speed ~0.82
    { name: "Apple", emoji: "🍎", rarity: "common", points: 1.45, growth: 1.4, speed: 0.91, odds: 30, model: "apple-cartoon3.glb", color: "#e23b3b", rim: "#8e1c1c" },
    { name: "Grapes", emoji: "🍇", rarity: "common", points: 1.42, growth: 1.48, speed: 0.72, odds: 28, model: "grapes-cartoon3.glb", color: "#7b3fa0", rim: "#4a2068" },
    { name: "Cookie", emoji: "🍪", rarity: "common", points: 1.38, growth: 1.32, speed: 0.95, odds: 24, model: "cookie-cartoon3.glb", color: "#c48a4a", rim: "#8a5a28" },
    { name: "Candy", emoji: "🍬", rarity: "common", points: 1.3, growth: 1.36, speed: 0.63, odds: 22, model: "candy-cartoon3.glb", color: "#ff5fa2", rim: "#d43a78" },
    { name: "Beans", emoji: "🫘", rarity: "common", points: 1.27, growth: 1.18, speed: 0.84, odds: 20, model: "beans-cartoon3.glb", color: "#e6c98a", rim: "#b89a62" },
    { name: "Bagel", emoji: "🥯", rarity: "common", points: 1.24, growth: 1.28, speed: 0.58, odds: 17, model: "bagel-cartoon3.glb", color: "#d4a15a", rim: "#a87430" },
    { name: "Toast", emoji: "🍞", rarity: "common", points: 1.18, growth: 1.15, speed: 0.82, odds: 14, model: "toast-cartoon3.glb", color: "#e6c07a", rim: "#c49848" },
    { name: "Kiwi", emoji: "🥝", rarity: "common", points: 1.15, growth: 1.22, speed: 0.7, odds: 11, model: "kiwi-cartoon3.glb", color: "#7cae3a", rim: "#8a5a28" },
    { name: "Watermelon", emoji: "🍉", rarity: "common", points: 1.12, growth: 1.08, speed: 0.55, odds: 9, model: "watermelon-cartoon3.glb", color: "#e23b4a", rim: "#2f8a3a" },
    { name: "Eggplant", emoji: "🍆", rarity: "common", points: 1.06, growth: 1.12, speed: 0.48, odds: 7, model: "eggplant-cartoon3.glb", color: "#6a3a86", rim: "#3e204e" },
    { name: "Popcorn", emoji: "🍿", rarity: "common", points: 1.03, growth: 0.98, speed: 0.88, odds: 6, model: "popcorn-cartoon3.glb", color: "#f4e27a", rim: "#d23b3b" },
    { name: "Peanut", emoji: "🥜", rarity: "common", points: 1.0, growth: 1.05, speed: 0.78, odds: 4, model: "peanut-cartoon3.glb", color: "#ff6b9a", rim: "#f2f2f2" },

    // Uncommon — avg speed ~1.07
    { name: "Lemon", emoji: "🍋", rarity: "uncommon", points: 2.3, growth: 2.08, speed: 1.35, odds: 200, model: "lemon-cartoon3.glb", color: "#f2e14a", rim: "#c9b420" },
    { name: "Honey", emoji: "🍯", rarity: "uncommon", points: 2.25, growth: 2.15, speed: 0.88, odds: 185, model: "honey-cartoon3.glb", color: "#f0b429", rim: "#c48410" },
    { name: "Cupcake", emoji: "🧁", rarity: "uncommon", points: 2.2, growth: 1.98, speed: 0.82, odds: 150, model: "cupcake-cartoon3.glb", color: "#f4a7c3", rim: "#e8d8c4" },
    { name: "Orange", emoji: "🍊", rarity: "uncommon", points: 2.0, growth: 2.05, speed: 1.05, odds: 135, model: "orange-cartoon3.glb", color: "#f28c28", rim: "#d06a10" },
    { name: "Croissant", emoji: "🥐", rarity: "uncommon", points: 1.9, growth: 1.88, speed: 0.7, odds: 120, model: "croissant-cartoon3.glb", color: "#e0b06a", rim: "#b07830" },
    { name: "Strawberry", emoji: "🍓", rarity: "uncommon", points: 1.85, growth: 1.95, speed: 1.42, odds: 105, model: "strawberry-cartoon3.glb", color: "#ef4b6c", rim: "#3a9a32" },
    { name: "Onion", emoji: "🧅", rarity: "uncommon", points: 1.8, growth: 1.78, speed: 1.22, odds: 93, model: "onion-cartoon3.glb", color: "#e8c98a", rim: "#c4a050" },
    { name: "Cherry", emoji: "🍒", rarity: "uncommon", points: 1.75, growth: 1.85, speed: 0.84, odds: 80, model: "cherry-cartoon3.glb", color: "#d42848", rim: "#2f8a32" },
    { name: "Carrot", emoji: "🥕", rarity: "uncommon", points: 1.72, growth: 1.68, speed: 1.55, odds: 71, model: "carrot-cartoon3.glb", color: "#f08a28", rim: "#3a9a32" },
    { name: "Peach", emoji: "🍑", rarity: "uncommon", points: 1.68, growth: 1.74, speed: 1.18, odds: 64, model: "peach-cartoon3.glb", color: "#f7b48a", rim: "#e07a58" },
    { name: "Corn", emoji: "🌽", rarity: "uncommon", points: 1.65, growth: 1.62, speed: 0.92, odds: 50, model: "corn-cartoon3.glb", color: "#f2d04a", rim: "#6aaa32" },

    // Rare — avg speed ~1.46
    { name: "Cheese", emoji: "🧀", rarity: "rare", points: 3.6, growth: 3.35, speed: 1.7, odds: 2500, model: "cheese-cartoon3.glb", color: "#ffe08a", rim: "#e0b040" },
    { name: "Potato", emoji: "🥔", rarity: "rare", points: 3.5, growth: 3.1, speed: 1.18, odds: 2400, model: "potato-cartoon3.glb", color: "#d4a05a", rim: "#a87838" },
    { name: "Coffee", emoji: "☕️", rarity: "rare", points: 3.4, growth: 3.2, speed: 1.05, odds: 1900, model: "coffee-cartoon3.glb", color: "#6b3e2e", rim: "#f4efe6" },
    { name: "Pancakes", emoji: "🥞", rarity: "rare", points: 3.25, growth: 2.95, speed: 1.88, odds: 1700, model: "pancakes-cartoon3.glb", color: "#f0c87a", rim: "#e8a04a" },
    { name: "Blueberry", emoji: "🫐", rarity: "rare", points: 3.15, growth: 3.05, speed: 1.72, odds: 1400, model: "blueberry-v2.glb", color: "#5a4ad4", rim: "#3a2e98" },
    { name: "Baugette", emoji: "🥖", rarity: "rare", points: 3.1, growth: 2.75, speed: 1.28, odds: 1100, model: "baguette-cartoon3.glb", color: "#e0b06a", rim: "#c49040" },
    { name: "Tomato", emoji: "🍅", rarity: "rare", points: 2.95, growth: 2.85, speed: 1.35, odds: 900, model: "tomato-cartoon3.glb", color: "#e23b32", rim: "#3a9a32" },
    { name: "Pepper", emoji: "🌶️", rarity: "rare", points: 2.85, growth: 2.6, speed: 1.98, odds: 800, model: "pepper-cartoon3.glb", color: "#d42828", rim: "#2f8a32" },
    { name: "Salad", emoji: "🥗", rarity: "rare", points: 2.8, growth: 2.7, speed: 1.62, odds: 700, model: "salad-cartoon3.glb", color: "#7ec86a", rim: "#e8f0d8" },
    { name: "Snow Cone", emoji: "🍧", rarity: "rare", points: 2.7, growth: 2.42, speed: 1.4, odds: 600, model: "snow-cone-cartoon3.glb", color: "#7ec8ff", rim: "#f4f8ff" },
    { name: "Egg", emoji: "🥚", rarity: "rare", points: 2.62, growth: 2.55, speed: 1.66, odds: 550, model: "egg-cartoon3.glb", color: "#f7f0e4", rim: "#e6d8c4" },
    { name: "Soda", emoji: "🥤", rarity: "rare", points: 2.6, growth: 2.35, speed: 1.45, odds: 500, model: "soda-cartoon3.glb", color: "#e23b3b", rim: "#f4f4f4" },

    // Epic — avg speed ~1.83
    { name: "Lava Cake", emoji: "🌋", rarity: "epic", points: 5.6, growth: 5.05, speed: 1.55, odds: 250000, model: "lava-cake-cartoon3.glb", color: "#6e6a64", rim: "#e25822" },
    { name: "Pudding", emoji: "🍮", rarity: "epic", points: 5.5, growth: 4.65, speed: 1.68, odds: 210000, model: "pudding-cartoon3.glb", color: "#f0d2a0", rim: "#c4a070" },
    { name: "Chocolate", emoji: "🍫", rarity: "epic", points: 5.35, growth: 4.8, speed: 2.25, odds: 170000, model: "chocolate-cartoon3.glb", color: "#5a2e1e", rim: "#3a1c12" },
    { name: "Cake Slice", emoji: "🍰", rarity: "epic", points: 5.1, growth: 4.4, speed: 1.8, odds: 140000, model: "cake-slice-cartoon3.glb", color: "#ffc9de", rim: "#f4f0ea" },
    { name: "Milk", emoji: "🥛", rarity: "epic", points: 4.9, growth: 4.55, speed: 2.18, odds: 100000, model: "milk-cartoon3.glb", color: "#f7f4ee", rim: "#e8e4dc" },
    { name: "Taco", emoji: "🌮", rarity: "epic", points: 4.85, growth: 4.2, speed: 2.05, odds: 90000, model: "taco-cartoon3.glb", color: "#e8c07a", rim: "#c44828" },
    { name: "Pie", emoji: "🥧", rarity: "epic", points: 4.7, growth: 4.35, speed: 1.7, odds: 79000, model: "pie-cartoon3.glb", color: "#e8b06a", rim: "#c4783a" },
    { name: "Mango", emoji: "🥭", rarity: "epic", points: 4.5, growth: 4.0, speed: 1.62, odds: 60000, model: "mango-cartoon3.glb", color: "#f0b030", rim: "#e07020" },
    { name: "Ice", emoji: "🧊", rarity: "epic", points: 4.4, growth: 4.15, speed: 2.4, odds: 43000, model: "ice-cartoon3.glb", color: "#c8ecff", rim: "#9ad4f0" },
    { name: "Burger", emoji: "🍔", rarity: "epic", points: 4.3, growth: 3.75, speed: 1.35, odds: 30000, model: "burger-cartoon3.glb", color: "#c48a4a", rim: "#6aaa32" },
    { name: "Banana", emoji: "🍌", rarity: "epic", points: 4.15, growth: 3.9, speed: 2.32, odds: 25000, model: "banana-cartoon3.glb", color: "#f2d04a", rim: "#e0b020" },
    { name: "Sundae", emoji: "🍨", rarity: "epic", points: 4.1, growth: 3.65, speed: 1.95, odds: 10000, model: "sundae-cartoon3.glb", color: "#f4e4d4", rim: "#f2c0d0" },

    // Legendary — avg speed ~2.17
    { name: "Mooncake", emoji: "🥮️", rarity: "legendary", points: 8.4, growth: 7.4, speed: 2.6, odds: 40000000, model: "mooncake-cartoon3.glb", color: "#e0b060", rim: "#c49030" },
    { name: "Bacon", emoji: "🥓", rarity: "legendary", points: 8.2, growth: 6.7, speed: 1.72, odds: 35000000, model: "bacon-cartoon3.glb", color: "#e07070", rim: "#f4d0c0" },
    { name: "Olive", emoji: "🫒", rarity: "legendary", points: 8.0, growth: 6.9, speed: 1.55, odds: 30000000, model: "olive-v2.glb", color: "#6a9a32", rim: "#4a7020" },
    { name: "Pizza", emoji: "🍕", rarity: "legendary", points: 7.8, growth: 6.3, speed: 2.22, odds: 26000000, model: "pizza-cartoon3.glb", color: "#e8a04a", rim: "#d44838" },
    { name: "Cake", emoji: "🎂", rarity: "legendary", points: 7.6, growth: 6.55, speed: 2.85, odds: 2200000, model: "cake-cartoon3.glb", color: "#ffd6a8", rim: "#f48ab0" },
    { name: "Coconut", emoji: "🥥", rarity: "legendary", points: 7.2, growth: 6.0, speed: 1.9, odds: 2000000, model: "coconut-cartoon3.glb", color: "#f4efe4", rim: "#6a4a30" },
    { name: "Waffle", emoji: "🧇", rarity: "legendary", points: 7.0, growth: 6.2, speed: 2.48, odds: 1800000, model: "waffle-cartoon3.glb", color: "#e0a04a", rim: "#c47828" },
    { name: "Parfait Tower", emoji: "🥂", rarity: "legendary", points: 6.9, growth: 5.6, speed: 2.35, odds: 1400000, model: "parfait-tower-v2.glb", color: "#f7f4ee", rim: "#f2d56a" },
    { name: "Dumpling", emoji: "🥟", rarity: "legendary", points: 6.6, growth: 5.85, speed: 1.88, odds: 1000000, model: "dumpling-cartoon3.glb", color: "#f0e0c8", rim: "#e8c8a0" },
    { name: "Ricecake", emoji: "🍙", rarity: "legendary", points: 6.5, growth: 5.5, speed: 2.15, odds: 500000, model: "ricecake-cartoon3.glb", color: "#f4f0e4", rim: "#2a2a2a" },

    // Mythic — avg speed ~2.80
    { name: "Rice", emoji: "🍚", rarity: "mythic", points: 14.0, growth: 11.2, speed: 2.8, odds: 1000000000, model: "rice-cartoon3.glb", color: "#f7f4ee", rim: "#e8d8c0" },
    { name: "Ramen", emoji: "🍜", rarity: "mythic", points: 13.2, growth: 10.6, speed: 2.72, odds: 950000000, model: "ramen-cartoon3.glb", color: "#e8a15a", rim: "#f4e4c8" },
    { name: "Steak", emoji: "🥩", rarity: "mythic", points: 12.6, growth: 9.4, speed: 3.35, odds: 700000000, model: "steak-cartoon3.glb", color: "#a84838", rim: "#6a2820" },
    { name: "Boba", emoji: "🧋", rarity: "mythic", points: 11.8, growth: 9.8, speed: 3.2, odds: 550000000, model: "boba-cartoon3.glb", color: "#c4a07a", rim: "#2a241c" },
    { name: "Hotdog", emoji: "🌭", rarity: "mythic", points: 11.4, growth: 8.9, speed: 2.15, odds: 350000000, model: "hotdog-cartoon3.glb", color: "#e05838", rim: "#f0d2a0" },
    { name: "Sushi", emoji: "🍣", rarity: "mythic", points: 10.8, growth: 9.2, speed: 2.35, odds: 250000000, model: "sushi-cartoon3.glb", color: "#f4a0a0", rim: "#f7f4ee" },
    { name: "Avocado", emoji: "🥑", rarity: "mythic", points: 10.4, growth: 8.3, speed: 2.9, odds: 200000000, model: "avocado-cartoon3.glb", color: "#6aaa32", rim: "#c4a05a" },
    { name: "Champagne", emoji: "🍾", rarity: "mythic", points: 9.8, growth: 8.6, speed: 2.95, odds: 150000000, model: "champagne-v2.glb", color: "#2a6a32", rim: "#f2d56a" },
    { name: "Donut", emoji: "🍩", rarity: "mythic", points: 9.6, growth: 8.1, speed: 3.1, odds: 100000000, model: "donut.glb", color: "#e8a0c0", rim: "#f2d06a" },
];

