let p7 = fun f -> fun k -> k (f (fun x -> x)) (f (fun x -> fun y -> x))
let p9 = (fun id -> fun k -> k (id (fun x -> x)) (id (fun x -> fun y -> x))) (fun x -> x)
let p10 = fun x -> let a = x in fun k -> k (a (fun x -> x)) (a (fun x -> fun y -> x))
let p14 = fun z -> let id = fun x -> let discard = if true then z else (fun y -> let ignored = x in y) in x in id id
