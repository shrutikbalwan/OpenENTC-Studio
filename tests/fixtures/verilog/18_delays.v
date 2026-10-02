module tb;
  reg a = 0, b = 0, c; reg [7:0] v = 0;
  always @(a or b) c = #2 a & b;
  initial begin
    $monitor("%0t a=%b b=%b c=%b v=%0d", $time, a, b, c, v);
    #1 a = 1; #1 b = 1; #5 b = 0;
    v <= #3 8'd42; v = 1;
    #0 $display("after #0 v=%0d", v);
    #10 $strobe("strobe v=%0d", v); v = 7;
    #1 $finish;
  end
endmodule
