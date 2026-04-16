# Beautiful Bible Data — Interactive Cross-References
 
**Explore 340,000+ Bible cross-references as an interactive, zoomable visualization.**
 
🌐 **Live site:** [beautifulbibledata.com](https://beautifulbibledata.com)
 <img width="1358" height="659" alt="grafik" src="https://github.com/user-attachments/assets/7a3986d0-7508-4659-a93c-b8d1d68ee4c4" />
---
 
## About
 
The Bible contains over 340,000 cross-references — links between verses, books, prophecies, and fulfillments that tie Scripture together from Genesis to Revelation. This project lets you see and explore every one of them.
 
Each arc connects two chapters in the Bible. The bars along the bottom represent chapter lengths. Click any chapter to highlight the references flowing in and out of it. Zoom in for detail, zoom out to see the full structure of Scripture. Open the reader to drop into any verse and walk through its references side by side.


---
 
## Features
 
- 🔍 **Zoom in and out** across the full biblical canon
- 🎯 **Click any arc** to see the two passages it connects, side by side
- 📖 **Built-in reader** — view every cross-reference for any verse
- 🔎 **Chapter search** — instantly see all arcs flowing out of a chosen chapter
- 🎛️ **Scope filters** — Old Testament only, New Testament only, OT ↔ NT connections, or Messianic prophecies
- 💪 **Strength filter** — set a minimum connection strength (1+, 5+, 10+, and beyond) to surface only the most significant references, or lower the threshold to reveal the full density of Scripture's internal links
- ⚡ **Performance** — the on-screen preview renders up to 5,000 arcs at a time, while the full 340,000-reference dataset is always accessible through the reader, search, and filters
---

<img width="1338" height="581" alt="grafik" src="https://github.com/user-attachments/assets/d37905d4-da24-472a-a165-ddd29895a00d" />

 


 
## Credit Where It's Due
 

This project stands on the shoulders of others.
 
The original arc visualization of Bible cross-references was created by **[Chris Harrison](https://www.chrisharrison.net/index.php/Visualizations/BibleViz)** in collaboration with **Christoph Römhild** in 2007 — a now-iconic piece of information design that mapped 63,000 cross-references as colored arcs. Harrison and Römhild's goal was to create something "more beautiful than functional," and they succeeded so well that their image has inspired a generation of data visualization work.
 
The cross-reference dataset powering this visualization comes from **[OpenBible.info](https://www.openbible.info/labs/cross-references/)**, who have also published several excellent visualizations of their own using the same data.

<img width="1346" height="653" alt="grafik" src="https://github.com/user-attachments/assets/6a005d9f-c1a2-4342-b833-3ddf20ee2237" />

 
**[Robert Rouse]([https://www.datacrossings.com)](https://viz.bible/remaking-an-influential-cross-reference-visualization/)** built an influential interactive remake of Harrison's visualization in Tableau, analyzing over 340,000 connections from Torrey's *Treasury of Scripture Knowledge*. His remake introduced clickable chapter highlighting and tooltips, and his writing on what the dataset reveals — and what it *doesn't* reveal — about the structure of Scripture was a direct inspiration for this project.
 
Other designers and developers — including the *Similar Diversity* project, which extended the concept to the holy texts of five major religions — have remade the visualization in different forms over the years.
 
This version is my contribution to that lineage: fully interactive, zoomable, searchable, with filters for scope and connection strength, and a reader built in so you can actually *read* the connections rather than just admire them.
 
---

<img width="1353" height="670" alt="grafik" src="https://github.com/user-attachments/assets/5b43d338-6508-46ee-89ba-0ea1f5df969d" />

 
## About the Data
 
The cross-reference dataset used in this project comes from **[OpenBible.info](https://www.openbible.info/labs/cross-references/)**, who compiled and released it as an open resource for the community. The underlying references trace back to **R.A. Torrey's *Treasury of Scripture Knowledge***, a 19th-century index of biblical cross-references organized primarily by topic rather than direct quotation.
 
This is why some patterns surprise first-time viewers — for example, the book of Revelation shows fewer visible links to Old Testament prophetic books than you might expect, because the index was built around topical connections rather than direct allusion. Exploring the visualization is, in part, a way of exploring how these references were originally organized.
 
Huge thanks to OpenBible.info for making this dataset freely available — this project would not exist without their work.
 
---
 
## Usage
 
Visit **[beautifulbibledata.com](https://beautifulbibledata.com)** to explore the visualization directly in your browser. No installation required.
 
### Quick tips
 
1. **Start zoomed out** to get a feel for the overall structure.
2. **Raise the strength filter** (to 5+ or 10+) to see the backbone of Scripture's internal links.
3. **Click a chapter bar** at the bottom to isolate its connections.
4. **Open the reader** from any arc to read both passages side by side.
5. **Apply a scope filter** (OT ↔ NT, Messianic) to study specific themes.
---
 
## Tech & Dataset
 
- **Dataset:** [OpenBible.info cross-references](https://www.openbible.info/labs/cross-references/) — ~340,000 references, derived from R.A. Torrey's *Treasury of Scripture Knowledge*
- **Rendering cap:** 5,000 arcs per view for performance; full dataset available via reader and search
---

 <img width="1326" height="651" alt="grafik" src="https://github.com/user-attachments/assets/e399bb43-6788-42d0-8411-b275b1dd005b" />

## Contact & Feedback
 
Found a bug, have an idea, or want to collaborate? Open an issue or reach out through [beautifulbibledata.com](https://beautifulbibledata.com).
 
---
 
## License
 
See [LICENSE](./LICENSE) for details on this project's code.
 
*The cross-reference dataset is provided by [OpenBible.info](https://www.openbible.info/labs/cross-references/) under their own terms — please refer to their site for licensing details if you wish to reuse the data.*
 
