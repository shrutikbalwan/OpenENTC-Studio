module tb;
  reg r = 1; reg [3:0] q;
  initial $display("init sees r=%b q=%b", r, q);
  always @(posedge r) begin q = 5; $display("posedge r seen q=%d", q); end
  initial #1 $display("t1 q=%d", q);
  reg [3:0] n;
  initial begin
    n = 4'bx01z; $display("[%d] [%h] [%o]", n, n, n);
    n = 4'bzzzz; $display("[%d] [%h]", n, n);
    n = 4'bxxxx; $display("[%d] [%h]", n, n);
    n = 4'bzz01; $display("[%d] [%h]", n, n);
    n = 4'bxz00; $display("[%d] [%h] [%b]", n, n, n);
    $display("[%t] [%0t] [%5d] [%0b] [%s] [%c]", $time, $time, 4'd7, 4'b0010, "hi", 8'h41);
    $display(4'd3, 8'd200, "x", -5);
  end
endmodule
