#!/usr/bin/env python

import json
from build_network import Graph

with open("data.json") as f:
    data = json.load(f)

with open("selection.json") as f:
    selection = json.load(f)
    ids = {}
    for k in selection:
        for id in selection[k]:
            ids[id] = k.encode("utf8")

def formatt(s):
    if not isinstance(s, unicode):
        return str(s)
    s = s.encode("utf8")
    return '"' + s.replace('"', '""') + '"' if "," in s else s

G = Graph()
fields = ["vendor", "vendor_rating", "vendor_ratings", "price", "condition", "description"]
print "jeu,"+",".join(fields)
for annonce in data:
    if annonce["id"] not in ids:
        continue
    print ids[annonce["id"]] + "," + ",".join([formatt(annonce[f]) for f in fields])
    G.add_node(ids[annonce["id"]], type="jeu")
    G.add_node(annonce["vendor"], type="vendeur", ratings=annonce["vendor_ratings"])
    G.add_edge(ids[annonce["id"]], annonce["vendor"])
    G.write_graph_in_format("network", "gexf")

