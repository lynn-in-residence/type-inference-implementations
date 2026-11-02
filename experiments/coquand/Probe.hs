
-- Harness only; the preceding author file is concatenated without edits.
-- Let's field order is the author's evaluator/paper order: value, type, body.
polyId :: Exp
polyId = Abs "A" (Abs "x" (Var "x"))
polyIdTy :: Exp
polyIdTy = Pi "A" Type (Pi "x" (Var "A") (Var "A"))
identity :: Exp
identity = Abs "x" (Var "x")
identityTy :: Exp
identityTy = Pi "x" Type Type

checkClosed :: Exp -> Exp -> Bool
checkClosed e a = checkType (0,[],[]) a && checkExp (0,[],[]) e (eval [] a)

-- Turning success into Bool keeps a failed inference distinguishable as error.
inferForced :: Exp -> Bool
inferForced e = case inferExp (0,[],[]) e of
  VType -> True
  _ -> True

main :: IO ()
main = mapM_ report
  [ ("polymorphic-identity", checkClosed polyId polyIdTy)
  , ("bare-lambda-synthesis", inferForced identity)
  , ("alpha-equivalent-identities", eqVal (0,eval [] identity,eval [] (Abs "y" (Var "y"))))
  , ("dependent-result-substitution", case inferExp (1,[("f",VGen 0)],[("f",eval [] (Pi "A" Type (Var "A")))]) (App (Var "f") Type) of VType -> True; _ -> False)
  , ("valid-let-type-type", checkClosed (Let "x" Type Type (Var "x")) Type)
  , ("invalid-let-annotation", checkClosed (Let "x" Type (Pi "A" Type (Var "A")) Type) Type)
  , ("valid-let-identity", checkClosed (Let "id" identity identityTy (Var "id")) identityTy)
  , ("unbound-variable", checkClosed (Var "missing") Type)
  ]
  where
    report (name,result) = do
      observed <- try (evaluate result) :: IO (Either SomeException Bool)
      putStrLn (name ++ "\t" ++ either (\e -> "error: " ++ takeWhile (/= '\n') (displayException e)) show observed)
