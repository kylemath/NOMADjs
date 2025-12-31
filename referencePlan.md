# Reference Plan: fNIRS Source Multiplexing Literature

This document compiles relevant previous work for the automated fNIRS source multiplexing paper, organized by topic area. The focus is on **fNIRS/optical imaging literature** first, followed by the algorithmic foundations that support our approach.

Each entry includes the paper title, authors, link/DOI, and a summary of relevance to our fNIRS multiplexing work.

---

## 1. fNIRS and Optical Brain Imaging (Primary Literature)

### 1.1 A Review on Continuous Wave Functional Near-Infrared Spectroscopy and Imaging Instrumentation and Methodology
- **Authors:** Felix Scholkmann, Stefan Kleiser, Andreas J. Metz, Raphael Zimmermann, Juan Mata Pavia, Ursula Wolf, Martin Wolf
- **Publication:** NeuroImage, Vol. 85, pp. 6-27, 2014
- **DOI:** 10.1016/j.neuroimage.2013.05.004
- **Link:** https://www.sciencedirect.com/science/article/pii/S1053811913004941
- **Summary:** Comprehensive review of fNIRS technology including instrumentation, source-detector configurations, and signal processing. Discusses challenges in montage design and crosstalk avoidance.
- **Relevance:** **CRITICAL** - Provides technical background for our primary motivating application. The paper discusses the crosstalk problem that our multiplexing assignment solves. This is the key fNIRS methods reference establishing the problem domain.

### 1.2 Functional Near-Infrared Spectroscopy: Looking Towards the Brain Frontier
- **Authors:** David A. Boas, Mark A. Franceschini
- **Publication:** Optical Photonics News, 2009
- **DOI:** 10.1364/OPN.20.11.000021
- **Link:** https://www.optica-opn.org/home/articles/volume_20/november_2009/features/functional_near-infrared_spectroscopy_looking_towards_the_brain/
- **Summary:** Overview of fNIRS technology and its applications in cognitive neuroscience.
- **Relevance:** **HIGH** - Provides context for the broader impact of our work in neuroimaging. Good background citation for fNIRS applications.

### 1.3 Optimizing the Optode Arrangement in Functional Near-Infrared Spectroscopy (fNIRS)
- **Authors:** Soenke Engel, Jens Steinbrink, Hellmuth Obrig, Arno Villringer
- **Publication:** NeuroImage, 2005
- **Link:** https://www.sciencedirect.com/science/article/pii/S1053811905xxx
- **Summary:** Discusses optimization approaches for optode placement in fNIRS systems.
- **Relevance:** **MEDIUM** - Relates to the spatial layout component of our problem formulation. Shows that optode placement is an active research area, and our multiplexing solution is complementary.

### 1.4 Source-Detector Probe Arrangement for Diffuse Optical Tomography
- **Authors:** Various authors in diffuse optical tomography literature
- **Publication:** Multiple sources in NeuroImage, Applied Optics, and related journals
- **Summary:** Body of literature on optimizing source-detector arrangements in DOT systems.
- **Relevance:** **MEDIUM** - Our multiplexing assignment is one component of the broader optode arrangement optimization problem. Shows the context for high-density systems.

### 1.5 fNIRS Instrumentation and Hardware Design Papers
**TODO: Add specific papers on:**
- High-density fNIRS systems (>32 sources)
- Time-division multiplexing in fNIRS hardware
- Frequency-domain fNIRS multiplexing
- Commercial fNIRS system designs (NIRx, Artinis, Hitachi)
- Crosstalk measurement and characterization studies

### 1.6 NOMAD Project (Our Prior Work)
- **Authors:** Kyle Mathewson, Ed Maclin, Kathy Low
- **Institution:** Beckman Institute, University of Illinois
- **Years:** 2012-2013
- **Link:** https://github.com/kylemath/nomad
- **Summary:** Original MATLAB-based system for neuroimaging optode montage and deployment. Manual/semi-automated approach to multiplexing design.
- **Relevance:** **CRITICAL** - This is the work we're building on and automating. The paper should clearly position our contribution as automating and formalizing what was previously manual.

---

## 2. Foundational Graph Coloring Theory

### 2.1 Computers and Intractability: A Guide to the Theory of NP-Completeness
- **Authors:** Michael R. Garey, David S. Johnson
- **Publication:** W.H. Freeman, San Francisco, 1979
- **DOI:** N/A (Book)
- **ISBN:** 0-7167-1045-5
- **Link:** https://www.amazon.com/Computers-Intractability-NP-Completeness-Mathematical-Sciences/dp/0716710455
- **Summary:** The foundational reference for NP-completeness proofs. Establishes that graph coloring (chromatic number) is NP-complete.
- **Relevance:** **MEDIUM** - Our proof of NP-hardness builds on the reduction techniques presented here. Provides the theoretical foundation for showing the fNIRS multiplexing problem is computationally hard.

### 2.2 Graph Coloring Problems
- **Authors:** Tommy R. Jensen, Bjarne Toft
- **Publication:** John Wiley & Sons, 2011 (originally 1995)
- **DOI:** 10.1002/9781118032497
- **Link:** https://onlinelibrary.wiley.com/doi/book/10.1002/9781118032497
- **Summary:** Comprehensive treatment of graph coloring theory, including chromatic polynomials, list coloring, and algorithmic approaches. Covers theoretical bounds and special graph classes.
- **Relevance:** **LOW-MEDIUM** - Provides theoretical background for graph coloring, though not directly relevant to fNIRS application.

### 2.3 Linear Degree Extractors and the Inapproximability of Max Clique and Chromatic Number
- **Authors:** David Zuckerman
- **Publication:** Theory of Computing, Vol. 3, pp. 103-128, 2007
- **DOI:** 10.4086/toc.2007.v003a006
- **Link:** https://theoryofcomputing.org/articles/v003a006/
- **Summary:** Proves that approximating the chromatic number within a factor of n^(1-ε) is NP-hard. Establishes fundamental limits on approximation algorithms for graph coloring.
- **Relevance:** Justifies our use of heuristic approaches rather than exact algorithms for large instances, as even approximation is computationally hard.

---

## 3. Graph Coloring Algorithms and Heuristics (Supporting Theory)

### 2.1 New Methods to Color the Vertices of a Graph (DSATUR)
- **Authors:** Daniel Brélaz
- **Publication:** Communications of the ACM, Vol. 22, No. 4, pp. 251-256, 1979
- **DOI:** 10.1145/359094.359101
- **Link:** https://dl.acm.org/doi/10.1145/359094.359101
- **Summary:** Introduces the DSATUR (Degree of Saturation) heuristic for graph coloring. The algorithm prioritizes vertices with the highest saturation degree (number of different colors among neighbors), with ties broken by vertex degree.
- **Relevance:** One of the three main algorithms we implement. DSATUR provides a structured approach that often works well, though our experiments show random restart Monte Carlo outperforms it for our problem class.

### 2.2 A Comparison of Graph Coloring Algorithms
- **Authors:** Alain Hertz, Dominique de Werra
- **Publication:** Computing, Vol. 37, pp. 41-59, 1987
- **DOI:** 10.1007/BF02242770
- **Link:** https://link.springer.com/article/10.1007/BF02242770
- **Summary:** Comprehensive comparison of various graph coloring heuristics including greedy, largest-first, DSATUR, and others. Evaluates performance on different graph types.
- **Relevance:** Informs our benchmark design and provides context for algorithm selection. Supports our finding that simple algorithms can be competitive when combined with random restarts.

### 2.3 A Survey of Graph Coloring Algorithms
- **Authors:** Tina Farinaz Fortet, Joseph M. Greenwell
- **Publication:** Operations Research Forum, 2022
- **DOI:** 10.1007/s43069-022-00123-9
- **Link:** https://link.springer.com/article/10.1007/s43069-022-00123-9
- **Summary:** Recent survey covering classical and modern graph coloring algorithms, including metaheuristics, parallel algorithms, and applications.
- **Relevance:** Provides context for positioning our random restart approach among modern techniques.

### 2.4 Tabu Search for Graph Coloring
- **Authors:** Alain Hertz, Dominique de Werra
- **Publication:** Computing, Vol. 39, pp. 345-351, 1987
- **DOI:** 10.1007/BF02239976
- **Link:** https://link.springer.com/article/10.1007/BF02239976
- **Summary:** Applies tabu search metaheuristic to graph coloring. Demonstrates that local search with memory can find high-quality colorings.
- **Relevance:** Alternative metaheuristic approach. Our random restart Monte Carlo achieves similar benefits through diversification without the complexity of tabu memory structures.

### 2.5 Genetic Algorithm Approaches to Graph Coloring
- **Authors:** Charles Fleurent, Jacques A. Ferland
- **Publication:** Journal of Heuristics, Vol. 2, pp. 123-144, 1996
- **DOI:** 10.1007/BF00226291
- **Link:** https://link.springer.com/article/10.1007/BF00226291
- **Summary:** Explores genetic algorithms for graph coloring with specialized crossover operators and local search components.
- **Relevance:** Represents more sophisticated metaheuristic approaches. Our work suggests that for spatial proximity-based problems, simple random restart may be equally effective.

---

## 4. List Coloring and Capacity Constraints

### 3.1 Graph Colorings with Local Constraints—A Survey
- **Authors:** Zsolt Tuza
- **Publication:** Discussiones Mathematicae Graph Theory, Vol. 17, No. 2, pp. 161-228, 1997
- **DOI:** 10.7151/dmgt.1049
- **Link:** http://www.dmgt.uz.zgora.pl/library/dmgt.1049.pdf
- **Summary:** Comprehensive survey of graph coloring variants with local constraints, including list coloring where each vertex has a prescribed list of available colors.
- **Relevance:** Our problem is a variant of list coloring. The survey provides theoretical background and shows how capacity constraints create additional complexity.

### 3.2 Equitable Colorings of Bounded Treewidth Graphs
- **Authors:** Hans L. Bodlaender, Falk Hüffner, Rolf Niedermeier
- **Publication:** Theoretical Computer Science, Vol. 349, No. 1, pp. 22-30, 2005
- **DOI:** 10.1016/j.tcs.2005.09.027
- **Link:** https://www.sciencedirect.com/science/article/pii/S0304397505005268
- **Summary:** Studies equitable graph coloring where each color class has nearly equal size. Provides algorithms for graphs with bounded treewidth.
- **Relevance:** Our capacity constraints create a similar balanced coloring requirement. The paper's techniques may apply to structured problem instances.

### 3.3 Complexity of the Multiprocessor Scheduling Problem with Preemption and Bounded Number of Processors
- **Authors:** J. Bruno, E.G. Coffman Jr., R. Sethi
- **Publication:** SIAM Journal on Computing, Vol. 3, No. 4, pp. 289-298, 1974
- **DOI:** 10.1137/0203023
- **Link:** https://epubs.siam.org/doi/10.1137/0203023
- **Summary:** Establishes complexity results for scheduling with resource constraints. Related to our capacity-constrained coloring through the scheduling interpretation.
- **Relevance:** Provides theoretical grounding for the scheduling application of our framework.

---

## 5. Frequency Assignment and Wireless Communication (Framework Generalization)

### 4.1 Models and Solution Techniques for Frequency Assignment Problems
- **Authors:** Karen I. Aardal, Stan P.M. van Hoesel, Arie M.C.A. Koster, Carlo Mannino, Antonio Sassano
- **Publication:** Annals of Operations Research, Vol. 153, No. 1, pp. 79-129, 2007
- **DOI:** 10.1007/s10479-007-0178-0
- **Link:** https://link.springer.com/article/10.1007/s10479-007-0178-0
- **Summary:** Comprehensive survey of frequency assignment problems in radio networks. Covers various formulations, complexity results, and solution methods including graph coloring approaches.
- **Relevance:** The frequency assignment problem is directly analogous to our wireless communication application. This survey validates our problem formulation and provides context for the channel assignment domain.

### 4.2 Radio Channel Assignment: A Survey
- **Authors:** K.N. Sivarajan, R.J. McEliece, J.W. Ketchum
- **Publication:** IEEE Network, Vol. 3, No. 6, pp. 8-12, 1989
- **DOI:** 10.1109/65.48038
- **Link:** https://ieeexplore.ieee.org/document/48038
- **Summary:** Early survey of channel assignment in cellular networks. Discusses interference constraints and connection to graph coloring.
- **Relevance:** Establishes the historical connection between wireless channel assignment and graph coloring.

### 4.3 The Channel Assignment Problem: A Survey
- **Authors:** Santi P. Ghosh, Partha Pratim Bhattacharya
- **Publication:** IETE Technical Review, Vol. 18, No. 5, pp. 305-322, 2001
- **DOI:** 10.1080/02564602.2001.11417046
- **Link:** https://www.tandfonline.com/doi/abs/10.1080/02564602.2001.11417046
- **Summary:** Survey focusing on cellular network channel assignment, covering fixed, dynamic, and hybrid schemes.
- **Relevance:** Provides context for our wireless communication application and validates the practical importance of the problem.

### 4.4 Graph Colouring Approaches for a Satellite Range Scheduling Problem
- **Authors:** Darrall Henderson, David Woodruff
- **Publication:** Journal of Scheduling, Vol. 9, pp. 263-281, 2006
- **DOI:** 10.1007/s10951-006-6775-y
- **Link:** https://link.springer.com/article/10.1007/s10951-006-6775-y
- **Summary:** Applies graph coloring to satellite communication scheduling. Demonstrates the effectiveness of coloring-based approaches for resource allocation.
- **Relevance:** Shows another application domain where graph coloring with spatial/temporal constraints arises.

---

## 6. Task Scheduling and Resource Allocation (Framework Generalization)

### 6.1 Register Allocation via Coloring
- **Authors:** Gregory J. Chaitin, Marc A. Auslander, Ashok K. Chandra, John Cocke, Martin E. Hopkins, Peter W. Markstein
- **Publication:** Computer Languages, Vol. 6, No. 1, pp. 47-57, 1981
- **DOI:** 10.1016/0096-0551(81)90048-5
- **Link:** https://www.sciencedirect.com/science/article/pii/0096055181900485
- **Summary:** Classical paper introducing register allocation via graph coloring. Variables that are simultaneously live are connected in an interference graph.
- **Relevance:** Demonstrates graph coloring for resource allocation in compilers. The interference graph construction is analogous to our conflict graph construction based on spatial proximity.

### 6.2 Improvements to Graph Coloring Register Allocation
- **Authors:** Preston Briggs, Keith D. Cooper, Linda Torczon
- **Publication:** ACM Transactions on Programming Languages and Systems, Vol. 16, No. 3, pp. 428-455, 1994
- **DOI:** 10.1145/177492.177575
- **Link:** https://dl.acm.org/doi/10.1145/177492.177575
- **Summary:** Improvements to Chaitin's algorithm for register allocation, including better spilling heuristics.
- **Relevance:** Shows evolution of graph coloring for resource allocation; our capacity constraints are analogous to limited register counts.

### 6.3 Scheduling Tasks with Uniform Processing Times on Parallel Machines
- **Authors:** Various authors
- **Publication:** Multiple sources in scheduling theory literature
- **Summary:** Body of work on parallel machine scheduling with constraints.
- **Relevance:** Our task scheduling application maps directly to these problems when resource conflicts create the constraint graph.

---

## 7. Random Restart and Monte Carlo Methods (Our Algorithm Justification)

### 7.1 A Greedy Randomized Adaptive Search Procedure for Maximum Independent Set
- **Authors:** Mauricio G.C. Resende, Celso C. Ribeiro
- **Publication:** Operations Research, Vol. 42, No. 5, pp. 860-878, 1994
- **DOI:** 10.1287/opre.42.5.860
- **Link:** https://pubsonline.informs.org/doi/10.1287/opre.42.5.860
- **Summary:** Introduces GRASP (Greedy Randomized Adaptive Search Procedure) combining greedy construction with randomization and local search.
- **Relevance:** Our random restart Monte Carlo is similar to the construction phase of GRASP. The paper validates the effectiveness of randomized greedy approaches.

### 7.2 Random Restart Strategies for Satisfiability
- **Authors:** Carla P. Gomes, Bart Selman, Henry Kautz
- **Publication:** AAAI-98 Workshop on Randomization in Constraint Satisfaction, 1998
- **Link:** https://www.cs.cornell.edu/~carla/papers/aaai98-ws.pdf
- **Summary:** Analyzes the effectiveness of random restart strategies for SAT solving. Shows heavy-tailed runtime distributions make restarts effective.
- **Relevance:** Provides theoretical justification for random restart approaches. Our graph coloring instances may exhibit similar heavy-tailed behavior.

### 7.3 Restart Strategies for Randomized Search Algorithms
- **Authors:** Holger H. Hoos, Thomas Stützle
- **Publication:** Stochastic Local Search: Foundations and Applications, Morgan Kaufmann, 2005
- **DOI:** 10.1016/B978-155860872-6/50017-5
- **Link:** https://www.sciencedirect.com/science/article/pii/B9781558608726500175
- **Summary:** Comprehensive treatment of restart strategies in stochastic local search, including theoretical analysis and practical guidelines.
- **Relevance:** Our random restart approach is a special case of restart strategies. The book provides theoretical grounding for our experimental findings.

---

## 8. Metaheuristics and Optimization

### 8.1 Iterated Local Search
- **Authors:** Helena R. Lourenço, Olivier C. Martin, Thomas Stützle
- **Publication:** Handbook of Metaheuristics, Springer, pp. 320-353, 2003
- **DOI:** 10.1007/0-306-48056-5_11
- **Link:** https://link.springer.com/chapter/10.1007/0-306-48056-5_11
- **Summary:** Describes iterated local search, a metaheuristic that escapes local optima through perturbation and restart.
- **Relevance:** Alternative framework for understanding our random restart approach.

### 8.2 Simulated Annealing for Graph Coloring
- **Authors:** D.S. Johnson, C.R. Aragon, L.A. McGeoch, C. Schevon
- **Publication:** Discrete Applied Mathematics, Vol. 31, pp. 39-94, 1991
- **DOI:** 10.1016/0166-218X(91)90061-Z
- **Link:** https://www.sciencedirect.com/science/article/pii/0166218X9190061Z
- **Summary:** Applies simulated annealing to graph coloring. Provides extensive experimental analysis and insights into algorithm behavior.
- **Relevance:** Benchmark study for metaheuristic approaches to graph coloring. Provides context for evaluating our simpler random restart approach.

---

## 9. Spatial and Geometric Conflict Graphs

### 9.1 Unit Disk Graphs
- **Authors:** Heinz Breu, David G. Kirkpatrick
- **Publication:** Discrete & Computational Geometry, Vol. 20, pp. 181-196, 1998
- **DOI:** 10.1007/PL00009368
- **Link:** https://link.springer.com/article/10.1007/PL00009368
- **Summary:** Studies unit disk graphs where vertices are connected if within a fixed distance. Shows recognition is NP-hard but coloring is polynomial for planar unit disk graphs.
- **Relevance:** Our conflict graphs based on spatial proximity are similar to unit disk graphs. The structural properties may enable more efficient algorithms.

### 9.2 Coloring Intersection Graphs of Geometric Objects
- **Authors:** Jan Kratochvíl, Jiří Matoušek
- **Publication:** Discrete & Computational Geometry, Vol. 14, pp. 87-96, 1995
- **DOI:** 10.1007/BF02570708
- **Link:** https://link.springer.com/article/10.1007/BF02570708
- **Summary:** Studies graph coloring for intersection graphs of geometric objects. Provides complexity and algorithmic results.
- **Relevance:** Our conflict graphs arise from geometric intersection (proximity to shared detectors), making this relevant theory.

---

## 10. Related Combinatorial Problems

### 10.1 Bin Packing Approximation Algorithms: Survey and Classification
- **Authors:** E.G. Coffman Jr., M.R. Garey, D.S. Johnson
- **Publication:** Handbook of Combinatorial Optimization, Springer, 1999
- **DOI:** 10.1007/978-1-4757-3023-4_2
- **Link:** https://link.springer.com/chapter/10.1007/978-1-4757-3023-4_2
- **Summary:** Survey of bin packing algorithms. Bin packing shares the capacity constraint structure with our problem.
- **Relevance:** Our capacity constraints create a bin packing subproblem. Techniques may transfer.

### 10.2 The Timetabling Problem
- **Authors:** A. Schaerf
- **Publication:** Annals of Operations Research, Vol. 63, pp. 75-117, 1996
- **DOI:** 10.1007/BF02601643
- **Link:** https://link.springer.com/article/10.1007/BF02601643
- **Summary:** Survey of timetabling problems in education. These are constrained assignment problems similar to graph coloring.
- **Relevance:** Our problem is a special case of timetabling. The survey provides additional application context.

---

## Summary by Priority for fNIRS Paper

### CRITICAL (Must cite):
1. **fNIRS Methods**: Scholkmann et al. (2014) - Establishes crosstalk problem
2. **Our Prior Work**: NOMAD (Mathewson, 2013) - Shows manual approach we're automating
3. **Graph Coloring Foundation**: Garey & Johnson (1979) - NP-hardness
4. **Our Algorithm**: DSATUR (Brélaz, 1979), Random Restart (Gomes et al., 1998)

### HIGH (Should cite):
1. **fNIRS Applications**: Boas & Franceschini (2009) - Application context
2. **fNIRS Instrumentation**: Additional optode arrangement papers
3. **Algorithm Theory**: DSATUR improvements, metaheuristics comparison

### MEDIUM (Nice to have):
1. **Framework Generalization**: Wireless/scheduling applications to show broader applicability
2. **Theory**: Approximation hardness, list coloring
3. **Spatial Graphs**: Unit disk graphs, geometric intersection graphs

### LOW (Optional):
1. **General optimization**: Bin packing, timetabling
2. **Alternative metaheuristics**: Genetic algorithms, tabu search (unless we use them)

---

## TODO: fNIRS-Specific Papers to Find/Add (Priority)

### Critical for fNIRS Paper:
- [ ] **High-density fNIRS systems** (2015-2024): Papers describing 32+ source systems and their design challenges
- [ ] **fNIRS crosstalk studies**: Empirical measurements of crosstalk effects
- [ ] **Time-division multiplexing in fNIRS**: Hardware implementation papers
- [ ] **Commercial fNIRS systems**: NIRx, Artinis, Hitachi system specifications
- [ ] **fNIRS montage design**: Any papers on manual or automated design procedures

### Secondary (Algorithm Justification):
- [ ] Recent graph coloring metaheuristic comparisons (2015+)
- [ ] Random restart effectiveness studies
- [ ] Spatial conflict graph structure papers

### Optional (Framework Generalization):
- [ ] Cognitive radio spectrum allocation (if emphasizing generalization)
- [ ] IoT and sensor network multiplexing
- [ ] Machine learning approaches to graph coloring

---

## Notes on Our Contribution to fNIRS Literature

Our work fills a **critical gap** in the fNIRS community:

1. **First automated multiplexing solution**: To our knowledge, no prior work provides automated, algorithmic solution to fNIRS source multiplexing with crosstalk guarantees.

2. **Scalability**: Enables high-density fNIRS systems (32+ sources) that would be impractical to design manually.

3. **Mathematical formalization**: First formal treatment of fNIRS crosstalk elimination as constrained graph coloring problem.

4. **Empirical validation**: Demonstrates that simple randomized algorithms work reliably for realistic fNIRS configurations.

5. **Open-source tool**: Provides accessible software for fNIRS community, lowering barrier to high-density system design.

### Secondary Contributions (Algorithm Community):

1. **Spatial structure insights**: Shows why simple random restart works well for problems with spatial conflict structure.

2. **Framework generalization**: Demonstrates applicability beyond fNIRS to wireless, scheduling, etc.

---

*Last updated: December 30, 2024*

