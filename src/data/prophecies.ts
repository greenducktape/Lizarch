export interface Prophecy {
  source: string; // e.g., "Isaiah 7:14"
  target: string; // e.g., "Matthew 1:23"
  type: 'MESSIANIC' | 'GENERAL';
  description: string;
}

export const PROPHECIES: Prophecy[] = [
  // Messianic Prophecies
  { source: "Genesis 3:15", target: "Galatians 4:4", type: "MESSIANIC", description: "Seed of the woman" },
  { source: "Genesis 12:3", target: "Acts 3:25", type: "MESSIANIC", description: "Seed of Abraham" },
  { source: "Genesis 17:19", target: "Matthew 1:2", type: "MESSIANIC", description: "Seed of Isaac" },
  { source: "Numbers 24:17", target: "Matthew 2:2", type: "MESSIANIC", description: "Star out of Jacob" },
  { source: "Genesis 49:10", target: "Luke 3:33", type: "MESSIANIC", description: "Tribe of Judah" },
  { source: "Isaiah 9:7", target: "Matthew 1:1", type: "MESSIANIC", description: "Heir to the Throne of David" },
  { source: "Micah 5:2", target: "Matthew 2:1", type: "MESSIANIC", description: "Born in Bethlehem" },
  { source: "Daniel 9:25", target: "Luke 2:1", type: "MESSIANIC", description: "Time of Birth" },
  { source: "Isaiah 7:14", target: "Matthew 1:18", type: "MESSIANIC", description: "Born of a Virgin" },
  { source: "Jeremiah 31:15", target: "Matthew 2:16", type: "MESSIANIC", description: "Slaughter of the Innocents" },
  { source: "Hosea 11:1", target: "Matthew 2:15", type: "MESSIANIC", description: "Flight to Egypt" },
  { source: "Isaiah 9:1", target: "Matthew 4:12", type: "MESSIANIC", description: "Ministry in Galilee" },
  { source: "Zechariah 9:9", target: "John 12:12", type: "MESSIANIC", description: "Triumphal Entry" },
  { source: "Psalm 41:9", target: "Mark 14:10", type: "MESSIANIC", description: "Betrayal by a Friend" },
  { source: "Zechariah 11:12", target: "Matthew 26:15", type: "MESSIANIC", description: "Sold for 30 Pieces of Silver" },
  { source: "Zechariah 11:13", target: "Matthew 27:5", type: "MESSIANIC", description: "Money Thrown in God's House" },
  { source: "Zechariah 11:13", target: "Matthew 27:7", type: "MESSIANIC", description: "Price Given for Potter's Field" },
  { source: "Isaiah 53:7", target: "Matthew 27:12", type: "MESSIANIC", description: "Silent Before Accusers" },
  { source: "Isaiah 50:6", target: "Matthew 26:67", type: "MESSIANIC", description: "Smitten and Spat Upon" },
  { source: "Psalm 22:16", target: "John 19:18", type: "MESSIANIC", description: "Hands and Feet Pierced" },
  { source: "Isaiah 53:12", target: "Matthew 27:38", type: "MESSIANIC", description: "Crucified with Thieves" },
  { source: "Isaiah 53:3", target: "John 1:11", type: "MESSIANIC", description: "Rejected by His Own People" },
  { source: "Psalm 69:21", target: "Matthew 27:34", type: "MESSIANIC", description: "Given Gall and Vinegar" },
  { source: "Psalm 22:18", target: "John 19:23", type: "MESSIANIC", description: "Soldiers Cast Lots for Clothes" },
  { source: "Psalm 34:20", target: "John 19:33", type: "MESSIANIC", description: "Bones Not Broken" },
  { source: "Zechariah 12:10", target: "John 19:34", type: "MESSIANIC", description: "Side Pierced" },
  { source: "Isaiah 53:9", target: "Matthew 27:57", type: "MESSIANIC", description: "Buried in a Rich Man's Tomb" },
  { source: "Psalm 16:10", target: "Acts 2:31", type: "MESSIANIC", description: "Resurrection" },
  { source: "Psalm 68:18", target: "Acts 1:9", type: "MESSIANIC", description: "Ascension" },
  
  // General Prophecies (Examples)
  { source: "Joshua 6:26", target: "1 Kings 16:34", type: "GENERAL", description: "Curse of Jericho Rebuilt" },
  { source: "1 Kings 13:2", target: "2 Kings 23:15", type: "GENERAL", description: "Josiah Prophesied by Name" },
  { source: "Isaiah 44:28", target: "Ezra 1:1", type: "GENERAL", description: "Cyrus Prophesied by Name" },
  { source: "Jeremiah 25:11", target: "Daniel 9:2", type: "GENERAL", description: "70 Years Captivity" },
  { source: "Ezekiel 26:3", target: "Nehemiah 1:1", type: "GENERAL", description: "Destruction of Tyre" } // Note: Fulfillment is historical, but linking to Nehemiah as a placeholder for post-exilic era or we can omit if no direct verse. Let's keep biblical links.
];
